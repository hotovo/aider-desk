import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import ignore from 'ignore';
import {
  ContextFile,
  FileEdit,
  InputHistoryData,
  LogData,
  LogLevel,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  ToolData,
  UsageReportData,
  UserMessageData,
} from '@common/types';
import { fileExists, parseUsageReport } from '@common/utils';
import { BrowserWindow } from 'electron';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';
import { parse } from '@dotenvx/dotenvx';
import { McpAgent } from 'src/main/mcp-agent';

import { Connector } from './connector';
import { AIDER_DESK_CONNECTOR_DIR, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from './constants';
import logger from './logger';
import { EditFormat, MessageAction, ResponseMessage } from './messages';
import { DEFAULT_MAIN_MODEL, Store } from './store';

export class Project {
  private process: ChildProcessWithoutNullStreams | null = null;
  private connectors: Connector[] = [];
  private currentCommand: string | null = null;
  private currentQuestion: QuestionData | null = null;
  private allTrackedFiles: string[] = [];
  private questionAnswers: Map<string, 'y' | 'n'> = new Map();
  private currentResponseMessageId: string | null = null;
  private currentPromptId: string | null = null;
  private inputHistoryFile = '.aider.input.history';
  private contextFiles: ContextFile[] = [];
  private models: ModelsData | null = null;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];

  constructor(
    private readonly mainWindow: BrowserWindow,
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly mcpAgent: McpAgent,
  ) {}

  public start() {
    this.contextFiles.forEach((contextFile) => {
      this.mainWindow.webContents.send('file-added', {
        baseDir: this.baseDir,
        file: contextFile,
      });
    });

    void this.runAider();
    void this.sendInputHistoryUpdatedEvent();
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
    });
    this.connectors.push(connector);
    if (connector.listenTo.includes('add-file')) {
      this.contextFiles.forEach(connector.sendAddFileMessage);
    }

    // Set input history file if provided by the connector
    if (connector.inputHistoryFile) {
      this.inputHistoryFile = connector.inputHistoryFile;
      void this.sendInputHistoryUpdatedEvent();
    }
  }

  public removeConnector(connector: Connector) {
    this.connectors = this.connectors.filter((c) => c !== connector);
  }

  private getAiderProcessPidFilePath(): string {
    const hash = createHash('sha256').update(this.baseDir).digest('hex');
    return path.join(PID_FILES_DIR, `${hash}.pid`);
  }

  private async writeAiderProcessPidFile(): Promise<void> {
    if (!this.process?.pid) {
      return;
    }

    try {
      await fs.mkdir(PID_FILES_DIR, { recursive: true });
      await fs.writeFile(this.getAiderProcessPidFilePath(), this.process.pid.toString());
    } catch (error) {
      logger.error('Failed to write PID file:', { error });
    }
  }

  private removeAiderProcessPidFile() {
    try {
      unlinkSync(this.getAiderProcessPidFilePath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to remove PID file:', { error });
      }
    }
  }

  private async checkAndCleanupPidFile(): Promise<void> {
    const pidFilePath = this.getAiderProcessPidFilePath();
    try {
      if (await fileExists(pidFilePath)) {
        const pid = parseInt(await fs.readFile(pidFilePath, 'utf8'));
        await new Promise<void>((resolve, reject) => {
          treeKill(pid, 'SIGKILL', (err) => {
            if (err && !err.message.includes('No such process')) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        await fs.unlink(pidFilePath);
      }
    } catch (error) {
      logger.error('Error cleaning up old PID file:', { error });
    }
  }

  public async runAider(): Promise<void> {
    if (this.process) {
      await this.killAider();
    }

    await this.checkAndCleanupPidFile();

    this.currentCommand = null;
    this.currentQuestion = null;

    const settings = this.store.getSettings();
    const mainModel = this.store.getProjectSettings(this.baseDir).mainModel || DEFAULT_MAIN_MODEL;
    const weakModel = this.store.getProjectSettings(this.baseDir).weakModel;
    const environmentVariables = parse(settings.aider.environmentVariables);

    logger.info('Running Aider for project', {
      baseDir: this.baseDir,
      mainModel,
      weakModel,
    });
    const options = settings.aider.options;

    const args = ['-m', 'connector'];
    if (options) {
      const optionsArgs = (options.match(/(?:[^\s"]+|"[^"]*")+/g) as string[]) || [];
      // remove existing --model defined by user
      const modelIndex = optionsArgs.indexOf('--model');
      if (modelIndex !== -1 && modelIndex + 1 < optionsArgs.length) {
        optionsArgs.splice(modelIndex, 2);
      }
      args.push(...optionsArgs.map((option) => (option.startsWith('"') && option.endsWith('"') ? option.slice(1, -1) : option)));
    }
    args.push(...['--no-check-update', '--no-show-model-warnings']);

    args.push('--model', mainModel);

    if (weakModel) {
      args.push('--weak-model', weakModel);
    }

    logger.info('Running Aider with args:', { args });

    const env = {
      ...process.env,
      ...environmentVariables,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      CONNECTOR_SERVER_URL: `http://localhost:${SERVER_PORT}`,
    };

    // 检查Python命令路径是否存在
    const pythonCommand = existsSync(PYTHON_COMMAND) ? PYTHON_COMMAND : 
      (process.platform === 'win32' ? 'python' : 'python3');
    
    logger.info(`Using Python command: ${pythonCommand}`);
    
    // Spawn without shell to have direct process control
    this.process = spawn(pythonCommand, args, {
      cwd: this.baseDir,
      detached: false,
      env,
    });

    logger.info('Starting Aider...', { baseDir: this.baseDir });
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug('Aider output:', { output });

      if (this.currentCommand) {
        this.addCommandOutput(this.currentCommand, output);
      }
    });

    this.process.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.startsWith('Warning:')) {
        logger.debug(data);
        return;
      }
      if (output.startsWith('usage:')) {
        logger.debug(output);
        this.addLogMessage('error', output.includes('error:') ? output.substring(output.indexOf('error:')) : output);
        return;
      }

      logger.error('Aider stderr:', { baseDir: this.baseDir, error: output });
    });

    this.process.on('close', (code) => {
      logger.info('Aider process exited:', { baseDir: this.baseDir, code });
    });

    void this.writeAiderProcessPidFile();
  }

  public isStarted() {
    return !!this.process;
  }

  public async stop() {
    logger.info('Stopping project...', { baseDir: this.baseDir });
    await this.killAider();
  }

  private async killAider(): Promise<void> {
    if (this.process) {
      logger.info('Killing Aider...', { baseDir: this.baseDir });
      try {
        await new Promise<void>((resolve, reject) => {
          treeKill(this.process!.pid!, 'SIGKILL', (err) => {
            if (err) {
              logger.error('Error killing Aider process:', { error: err });
              reject(err);
            } else {
              this.removeAiderProcessPidFile();
              resolve();
            }
          });
        });

        this.currentCommand = null;
        this.currentQuestion = null;
        this.currentResponseMessageId = null;
        this.currentPromptId = null;
        this.currentPromptResponses = [];

        this.runPromptResolves.forEach((resolve) => resolve([]));
        this.runPromptResolves = [];

        this.mcpAgent.clearMessages(this);
      } catch (error: unknown) {
        logger.error('Error killing Aider process:', { error });
        throw error;
      } finally {
        this.process = null;
      }
    }
  }

  private findMessageConnectors(action: MessageAction): Connector[] {
    return this.connectors.filter((connector) => connector.listenTo.includes(action));
  }

  public async runPrompt(prompt: string, editFormat?: EditFormat): Promise<ResponseCompletedData[]> {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    // If a prompt is already running, wait for it to finish
    if (this.currentPromptId) {
      logger.info('Waiting for prompt to finish...');
      await new Promise<void>((resolve) => {
        this.runPromptResolves.push(() => resolve());
      });
    }

    logger.info('Running prompt:', {
      baseDir: this.baseDir,
      prompt,
      editFormat,
    });

    this.addUserMessage(prompt, editFormat);
    this.addLogMessage('loading');

    await this.addToInputHistory(prompt);

    const mcpPrompt = await this.mcpAgent.runPrompt(this, prompt, editFormat);
    if (!mcpPrompt) {
      return [];
    }

    const responses = await this.sendPrompt(mcpPrompt, editFormat);

    // Send all responses as assistant messages to MCP client
    for (const response of responses) {
      if (response.content) {
        this.mcpAgent.addMessage(this, 'assistant', response.content);
      }
    }

    return responses;
  }

  public sendPrompt(prompt: string, editFormat?: EditFormat): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
    this.currentResponseMessageId = null;
    this.currentPromptId = uuidv4();

    this.findMessageConnectors('prompt').forEach((connector) =>
      connector.sendPromptMessage(prompt, editFormat, this.getArchitectModel(), this.currentPromptId),
    );

    // Wait for prompt to finish and return collected responses
    return new Promise((resolve) => {
      this.runPromptResolves.push(resolve);
    });
  }

  private getArchitectModel(): string | null {
    return this.store.getProjectSettings(this.baseDir).architectModel || null;
  }

  public promptFinished() {
    if (this.currentResponseMessageId) {
      this.mainWindow.webContents.send('response-completed', {
        messageId: this.currentResponseMessageId,
        baseDir: this.baseDir,
        content: '',
      });
      this.currentResponseMessageId = null;
    }

    // Notify waiting prompts with collected responses
    const responses = [...this.currentPromptResponses];
    this.currentPromptResponses = [];
    this.currentPromptId = null;
    this.closeCommandOutput();

    while (this.runPromptResolves.length) {
      const resolve = this.runPromptResolves.shift();
      if (resolve) {
        resolve(responses);
      }
    }
  }

  public processResponseMessage(message: ResponseMessage) {
    if (!this.currentResponseMessageId) {
      this.currentResponseMessageId = uuidv4();
    }

    if (!message.finished) {
      logger.debug(`Sending response chunk to ${this.baseDir}`);
      const data: ResponseChunkData = {
        messageId: this.currentResponseMessageId,
        baseDir: this.baseDir,
        chunk: message.content,
        reflectedMessage: message.reflectedMessage,
      };
      this.mainWindow.webContents.send('response-chunk', data);
    } else {
      logger.info(`Sending response completed to ${this.baseDir}`);
      logger.debug(`Message data: ${JSON.stringify(message)}`);

      const usageReport = message.usageReport
        ? typeof message.usageReport === 'string'
          ? parseUsageReport(message.usageReport)
          : message.usageReport
        : undefined;
      logger.info(`Usage report: ${JSON.stringify(usageReport)}`);
      const data: ResponseCompletedData = {
        messageId: this.currentResponseMessageId,
        content: message.content,
        reflectedMessage: message.reflectedMessage,
        baseDir: this.baseDir,
        editedFiles: message.editedFiles,
        commitHash: message.commitHash,
        commitMessage: message.commitMessage,
        diff: message.diff,
        usageReport,
      };
      this.mainWindow.webContents.send('response-completed', data);
      this.currentResponseMessageId = null;
      this.closeCommandOutput();

      // Collect the completed response
      this.currentPromptResponses.push(data);
    }
  }

  private getQuestionKey(question: QuestionData) {
    return `${question.text}_${question.subject || ''}`;
  }

  public answerQuestion(answer: string): void {
    if (!this.currentQuestion) {
      return;
    }

    logger.info('Answering question:', {
      baseDir: this.baseDir,
      question: this.currentQuestion,
      answer,
    });

    const yesNoAnswer = answer.toLowerCase() === 'a' || answer.toLowerCase() === 'y' ? 'y' : 'n';
    if (answer.toLowerCase() === 'd' || answer.toLowerCase() === 'a') {
      logger.info('Storing answer for question:', {
        baseDir: this.baseDir,
        question: this.currentQuestion,
        answer,
      });
      this.questionAnswers.set(this.getQuestionKey(this.currentQuestion), yesNoAnswer);
    }

    this.findMessageConnectors('answer-question').forEach((connector) => connector.sendAnswerQuestionMessage(yesNoAnswer));
    this.currentQuestion = null;
  }

  private async isFileIgnored(contextFile: ContextFile): Promise<boolean> {
    if (contextFile.readOnly) {
      // not checking gitignore for read-only files
      return false;
    }

    const gitignorePath = path.join(this.baseDir, '.gitignore');

    if (!(await fileExists(gitignorePath))) {
      return false;
    }

    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    const ig = ignore().add(gitignoreContent);

    // Make the path relative to the base directory
    const absolutePath = path.resolve(this.baseDir, contextFile.path);
    const relativePath = path.relative(this.baseDir, absolutePath);

    return ig.ignores(relativePath);
  }

  public async addFile(contextFile: ContextFile): Promise<void> {
    logger.info('Adding file:', {
      path: contextFile.path,
      readOnly: contextFile.readOnly,
    });
    const alreadyAdded = this.contextFiles.find((file) => file.path === contextFile.path);
    if (alreadyAdded) {
      return;
    }

    if (await this.isFileIgnored(contextFile)) {
      logger.debug('Skipping ignored file:', { path: contextFile.path });
      return;
    }

    this.contextFiles.push({
      ...contextFile,
      readOnly: contextFile.readOnly ?? false,
    });
    this.findMessageConnectors('add-file').forEach((connector) => connector.sendAddFileMessage(contextFile));
  }

  public dropFile(filePath: string): void {
    logger.info('Dropping file:', { path: filePath });
    const file = this.contextFiles.find((f) => f.path === filePath);

    // Check if file is outside project directory
    const absolutePath = path.resolve(this.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.baseDir));

    const pathToSend = file?.readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.baseDir) ? filePath : path.join(this.baseDir, filePath);

    this.contextFiles = this.contextFiles.filter((file) => file.path !== filePath);
    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend));
  }

  public runCommand(command: string) {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    logger.info('Running command:', { command });
    this.findMessageConnectors('run-command').forEach((connector) => connector.sendRunCommandMessage(command));
  }

  public updateContextFiles(contextFiles: ContextFile[]) {
    this.contextFiles = contextFiles;

    this.mainWindow.webContents.send('context-files-updated', {
      baseDir: this.baseDir,
      files: contextFiles,
    });
  }

  public async loadInputHistory(): Promise<string[]> {
    try {
      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      const content = await fs.readFile(historyPath, 'utf8');

      if (!content) {
        return [];
      }

      const history: string[] = [];
      const lines = content.split('\n');
      let currentInput = '';

      for (const line of lines) {
        if (line.startsWith('# ')) {
          if (currentInput) {
            history.push(currentInput.trim());
            currentInput = '';
          }
        } else if (line.startsWith('+')) {
          currentInput += line.substring(1) + '\n';
        }
      }

      if (currentInput) {
        history.push(currentInput.trim());
      }

      return history.reverse();
    } catch (error) {
      logger.error('Failed to load input history:', { error });
      return [];
    }
  }

  public async addToInputHistory(message: string) {
    try {
      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      const timestamp = new Date().toISOString();
      const formattedMessage = `\n# ${timestamp}\n+${message.replace(/\n/g, '\n+')}\n`;

      await fs.appendFile(historyPath, formattedMessage);

      await this.sendInputHistoryUpdatedEvent();
    } catch (error) {
      logger.error('Failed to add to input history:', { error });
    }
  }

  private async sendInputHistoryUpdatedEvent() {
    const history = await this.loadInputHistory();
    const inputHistoryData: InputHistoryData = {
      baseDir: this.baseDir,
      messages: history,
    };
    this.mainWindow.webContents.send('input-history-updated', inputHistoryData);
  }

  public askQuestion(questionData: QuestionData) {
    this.currentQuestion = questionData;

    const storedAnswer = this.questionAnswers.get(this.getQuestionKey(questionData));

    logger.info('Asking question:', {
      baseDir: this.baseDir,
      question: questionData,
      answer: storedAnswer,
    });
    if (storedAnswer) {
      logger.info('Found stored answer for question:', {
        baseDir: this.baseDir,
        question: questionData,
        answer: storedAnswer,
      });
      // Auto-answer based on stored preference
      this.answerQuestion(storedAnswer);
      return;
    }

    this.mainWindow.webContents.send('ask-question', questionData);
  }

  public setAllTrackedFiles(files: string[]) {
    this.allTrackedFiles = files;
  }

  public setCurrentModels(modelsData: ModelsData) {
    this.models = {
      ...modelsData,
      architectModel: modelsData.architectModel !== undefined ? modelsData.architectModel : this.getArchitectModel(),
    };
    this.mainWindow.webContents.send('set-current-models', this.models);
  }

  public updateModels(mainModel: string, weakModel: string | null) {
    logger.info('Updating models:', {
      mainModel,
      weakModel,
    });
    this.findMessageConnectors('set-models').forEach((connector) => connector.sendSetModelsMessage(mainModel, weakModel));
  }

  public setArchitectModel(architectModel: string) {
    logger.info('Setting architect model', {
      architectModel,
    });
    this.setCurrentModels({
      ...this.models!,
      architectModel,
    });
  }

  public getAddableFiles(searchRegex?: string): string[] {
    const contextFilePaths = new Set(this.contextFiles.map((file) => file.path));
    let files = this.allTrackedFiles.filter((file) => !contextFilePaths.has(file));

    if (searchRegex) {
      try {
        const regex = new RegExp(searchRegex, 'i');
        files = files.filter((file) => regex.test(file));
      } catch (error) {
        logger.error('Invalid regex for getAddableFiles', {
          searchRegex,
          error,
        });
      }
    }

    return files;
  }

  public getContextFiles(): ContextFile[] {
    return this.contextFiles;
  }

  public openCommandOutput(command: string) {
    this.currentCommand = command;
    this.addCommandOutput(command, '');
  }

  public closeCommandOutput() {
    this.currentCommand = null;
  }

  private addCommandOutput(command: string, output: string) {
    this.mainWindow.webContents.send('command-output', {
      baseDir: this.baseDir,
      command: command,
      output,
    });
  }

  public addLogMessage(level: LogLevel, message?: string) {
    const data: LogData = {
      baseDir: this.baseDir,
      level,
      message,
    };

    this.mainWindow.webContents.send('log', data);
  }

  public sendAddContextMessage(role: 'user' | 'assistant' = 'user', content: string, acknowledge = true) {
    this.findMessageConnectors('add-message').forEach((connector) => connector.sendAddMessageMessage(role, content, acknowledge));
  }

  public clearContext() {
    this.mcpAgent.clearMessages(this);
    this.runCommand('clear');
  }

  public interruptResponse() {
    logger.info('Interrupting response:', { baseDir: this.baseDir });
    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.mcpAgent.interrupt();
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public addToolMessage(serverName: string, toolName: string, args?: Record<string, unknown>, response?: string, usageReport?: UsageReportData) {
    logger.debug('Sending tool message:', {
      baseDir: this.baseDir,
      serverName,
      name: toolName,
      args,
      response,
      usageReport,
    });
    const data: ToolData = {
      baseDir: this.baseDir,
      serverName,
      toolName,
      args,
      response,
      usageReport,
    };
    this.mainWindow.webContents.send('tool', data);
  }

  public addUserMessage(content: string, editFormat?: string) {
    logger.info('Adding user message:', {
      baseDir: this.baseDir,
      content,
      editFormat,
    });

    const data: UserMessageData = {
      baseDir: this.baseDir,
      content,
      editFormat,
    };

    this.mainWindow.webContents.send('user-message', data);
  }
}
