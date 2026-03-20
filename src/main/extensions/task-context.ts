import {
  AgentProfile,
  ContextFile,
  ContextMessage,
  Mode,
  PromptContext,
  QueuedPromptData,
  ResponseCompletedData,
  TaskData,
  TodoItem,
  UpdatedFile,
  UsageReportData,
} from '@common/types';

import type { QuestionOptions, TaskContext, ResponseMessage } from '@common/extensions';
import type { Task } from '@/task';

export class TaskContextImpl implements TaskContext {
  constructor(private readonly task: Task) {}

  get data(): TaskData {
    return this.task.task;
  }

  // Context Files (Read + Safe Write)

  async getContextFiles(): Promise<ContextFile[]> {
    return this.task.getContextFiles();
  }

  async addFile(path: string, readOnly = false): Promise<void> {
    await this.task.addFiles({ path, readOnly });
  }

  async addFiles(...files: ContextFile[]): Promise<void> {
    await this.task.addFiles(...files);
  }

  async dropFile(path: string): Promise<void> {
    await this.task.dropFile(path);
  }

  // Messages (Read + Safe Write)

  async getContextMessages(): Promise<ContextMessage[]> {
    return this.task.getContextMessages();
  }

  async addContextMessage(message: ContextMessage, updateContextInfo = false): Promise<void> {
    await this.task.addContextMessage(message, updateContextInfo);
  }

  async removeMessage(messageId: string): Promise<void> {
    await this.task.removeMessage(messageId);
  }

  async removeLastMessage(): Promise<void> {
    await this.task.removeLastMessage();
  }

  async loadContextMessages(messages: ContextMessage[]): Promise<void> {
    await this.task.loadContextMessages(messages);
  }

  async redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void> {
    await this.task.redoLastUserPrompt((mode as Mode) || 'agent', updatedPrompt);
  }

  async removeMessagesUpTo(messageId: string): Promise<void> {
    await this.task.removeMessagesUpTo(messageId);
  }

  addUserMessage(id: string, content: string, promptContext?: PromptContext) {
    this.task.addUserMessage(id, content, promptContext);
  }

  addToolMessage(
    id: string,
    serverName: string,
    toolName: string,
    input?: unknown,
    response?: string,
    usageReport?: UsageReportData,
    promptContext?: PromptContext,
    saveToDb = true,
    finished = !!response,
  ) {
    this.task.addToolMessage(id, serverName, toolName, input, response, usageReport, promptContext, saveToDb, finished);
  }

  async addResponseMessage(message: ResponseMessage, saveToDb = true) {
    await this.task.processResponseMessage(
      {
        ...message,
        action: 'response',
      },
      saveToDb,
    );
  }

  // Files & Repo (Read-only)

  getTaskDir(): string {
    return this.task.getTaskDir();
  }

  async getAddableFiles(searchRegex?: string): Promise<string[]> {
    return this.task.getAddableFiles(searchRegex);
  }

  async getAllFiles(useGit = true): Promise<string[]> {
    return this.task.getAllFiles(useGit);
  }

  async getUpdatedFiles(): Promise<UpdatedFile[]> {
    return this.task.getUpdatedFiles();
  }

  getRepoMap(): string {
    return this.task.getRepoMap();
  }

  async addToGit(path: string): Promise<void> {
    await this.task.addToGit(path);
  }

  // Todos (Read + Safe Write)

  async getTodos(): Promise<TodoItem[]> {
    return this.task.getTodos();
  }

  async addTodo(name: string): Promise<TodoItem[]> {
    return this.task.addTodo(name);
  }

  async updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return this.task.updateTodo(name, updates);
  }

  async deleteTodo(name: string): Promise<TodoItem[]> {
    return this.task.deleteTodo(name);
  }

  async clearAllTodos(): Promise<TodoItem[]> {
    return this.task.clearAllTodos();
  }

  async setTodos(items: TodoItem[], initialUserPrompt = ''): Promise<void> {
    await this.task.setTodos(items, initialUserPrompt);
  }

  // Execution

  async runPrompt(prompt: string, mode?: string): Promise<void> {
    await this.task.runPrompt(prompt, mode);
  }

  async runPromptInAgent(
    profile: AgentProfile,
    mode: string,
    prompt: string | null,
    promptContext?: PromptContext,
    contextMessages?: ContextMessage[],
    contextFiles?: ContextFile[],
    systemPrompt?: string,
    waitForCurrentAgentToFinish = true,
    sendNotification = true,
  ): Promise<ResponseCompletedData[]> {
    return this.task.runPromptInAgent(
      profile,
      mode as Mode,
      prompt,
      promptContext,
      contextMessages,
      contextFiles,
      systemPrompt,
      waitForCurrentAgentToFinish,
      sendNotification,
    );
  }

  async runCustomCommand(name: string, args: string[] = [], mode?: string): Promise<void> {
    await this.task.runCustomCommand(name, args, mode as Mode | undefined);
  }

  async runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void> {
    await this.task.runSubagent(agentProfile, prompt);
  }

  async runCommand(command: string): Promise<void> {
    await this.task.runCommand(command);
  }

  async interruptResponse(): Promise<void> {
    await this.task.interruptResponse();
  }

  async generateText(agentProfile: AgentProfile, systemPrompt: string, prompt: string): Promise<string | undefined> {
    return this.task.generateText(agentProfile, prompt, systemPrompt);
  }

  // User Interaction

  async askQuestion(text: string, options?: QuestionOptions): Promise<string> {
    const [answer] = await this.task.askQuestion({
      baseDir: this.task.getProjectDir(),
      taskId: this.data.id,
      text,
      subject: options?.subject,
      answers: options?.answers,
      defaultAnswer: options?.defaultAnswer ?? 'y',
    });
    return answer;
  }

  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void {
    this.task.addLogMessage(level, message);
  }

  addLoadingMessage(message?: string, finished?: boolean): void {
    this.task.addLogMessage('loading', message, finished);
  }

  // Task Management

  async updateTask(updates: Partial<TaskData>): Promise<TaskData> {
    return this.task.updateTask(updates);
  }

  async handoffConversation(focus?: string, execute = false): Promise<void> {
    const mode = this.data.currentMode || 'agent';
    await this.task.handoffConversation(mode as Mode, focus, execute);
  }

  // Context Management

  async clearContext(): Promise<void> {
    await this.task.clearContext();
  }

  async resetContext(): Promise<void> {
    await this.task.resetContext();
  }

  async compactConversation(instructions?: string): Promise<void> {
    await this.task.compactConversation('agent', instructions);
  }

  async generateContextMarkdown(): Promise<string | null> {
    return this.task.generateContextMarkdown();
  }

  isInitialized(): boolean {
    return this.task.isInitialized();
  }

  async updateAutocompletionWords(words?: string[]): Promise<void> {
    await this.task.updateAutocompletionData(words);
  }

  // Queued Prompts

  getQueuedPrompts(): QueuedPromptData[] {
    return this.task.getQueuedPrompts();
  }

  async sendQueuedPromptNow(promptId: string): Promise<void> {
    await this.task.sendQueuedPromptNow(promptId);
  }

  removeQueuedPrompt(promptId: string): void {
    this.task.removeQueuedPrompt(promptId);
  }

  // Advanced Operations

  async getTaskAgentProfile(): Promise<AgentProfile | null> {
    return this.task.getTaskAgentProfile();
  }

  async answerQuestion(answer: string, userInput?: string): Promise<boolean> {
    return this.task.answerQuestion(answer, userInput);
  }
}
