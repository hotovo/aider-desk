/**
 * Questions Extension
 *
 * Registers a '/questions' command that extracts questions from the last message
 * and displays them as an interactive questionnaire above the prompt field.
 *
 * Usage:
 * /questions
 *
 * Features:
 * - Extracts questions from the last message using AI
 * - Displays questions with navigation (left/right chevrons)
 * - Allows answering questions via text area
 * - Records answers and auto-switches to next question
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import type { Extension, ExtensionContext, CommandDefinition, UIComponentDefinition } from '@aiderdesk/extensions';

const CUSTOM_MODEL_ID = ''; // set this to your custom provider/model for extracting questions (e.g., 'openai/gpt-4o-mini')

interface Question {
  id: string;
  text: string;
}

interface QuestionsState {
  questions: Question[];
  currentIndex: number;
  isActive: boolean;
}

export default class QuestionsExtension implements Extension {
  static metadata = {
    name: 'Questions',
    version: '1.0.0',
    description: 'Extract questions from messages and display as interactive questionnaire',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/questions/icon.png',
    capabilities: ['commands', 'ui-elements'],
  };

  private taskStates: Map<string, QuestionsState> = new Map();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Questions Extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    this.taskStates.clear();
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [
      {
        name: 'questions',
        description: 'Extract questions from the last message and display as questionnaire',
        arguments: [],
        execute: async (_args: string[], context: ExtensionContext): Promise<void> => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            context.log('No active task context available', 'error');
            return;
          }

          const messages = await taskContext.getContextMessages();
          if (messages.length === 0) {
            taskContext.addLogMessage('warning', 'No messages found to extract questions from');
            return;
          }

          const lastMessage = messages[messages.length - 1];

          let messageText = '';
          if (typeof lastMessage.content === 'string') {
            messageText = lastMessage.content;
          } else if (Array.isArray(lastMessage.content)) {
            const textParts = lastMessage.content.filter((part) => part.type === 'text');
            messageText = textParts.map((part) => (part as { type: 'text'; text: string }).text).join('\n');
          }

          if (!messageText.trim()) {
            taskContext.addLogMessage('warning', 'Last message has no text content to extract questions from');
            return;
          }

          taskContext.addLoadingMessage('Extracting questions from the last message...');

          let modelId = CUSTOM_MODEL_ID;

          if (!modelId) {
            const agentProfile = await taskContext.getTaskAgentProfile();
            if (!agentProfile) {
              taskContext.addLogMessage('error', 'No agent profile available');
              return;
            }
            modelId = `${agentProfile.provider}/${agentProfile.model}`;
          }

          const systemPrompt = `You are a question extraction assistant. Your task is to identify and extract all questions from the given text.

Rules:
1. Extract only actual questions (sentences ending with "?")
2. Preserve the original wording of each question
3. Return the questions in JSON format as an array of strings
4. If no questions are found, return an empty array
5. Return ONLY the JSON array, no additional text or explanation

Example input: "What is the purpose of this function? How does it handle errors? This is not a question."
Example output: ["What is the purpose of this function?", "How does it handle errors?"]`;

          const prompt = `Extract all questions from the following text:

${messageText}`;

          try {
            const result = await taskContext.generateText(modelId, systemPrompt, prompt);

            if (!result) {
              taskContext.addLogMessage('error', 'Failed to generate questions');
              return;
            }

            let questions: string[] = [];
            try {
              const cleanedResult = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
              questions = JSON.parse(cleanedResult);

              if (!Array.isArray(questions)) {
                throw new Error('Result is not an array');
              }
            } catch (parseError) {
              context.log(`Failed to parse questions JSON: ${result}`, 'error');
              taskContext.addLogMessage('error', 'Failed to parse extracted questions');
              return;
            }

            if (questions.length === 0) {
              taskContext.addLogMessage('warning', 'No questions found in the last message');
              return;
            }

            const questionObjects: Question[] = questions.map((q, index) => ({
              id: `q-${Date.now()}-${index}`,
              text: q,
            }));

            this.setQuestions(taskContext.data.id, questionObjects);

            taskContext.addLoadingMessage(
              "Extracting questions from the last message...",
              true,
            );

            context.triggerUIDataRefresh('questions-questionnaire', taskContext.data.id);
          } catch (error) {
            context.log(`Error extracting questions: ${error}`, 'error');
            taskContext.addLogMessage('error', 'Failed to extract questions');
          }
        },
      },
    ];
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsx = readFileSync(join(__dirname, 'Questions.jsx'), 'utf-8');

    return [
      {
        id: 'questions-questionnaire',
        placement: 'task-input-above',
        jsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId === 'questions-questionnaire') {
      const taskContext = context.getTaskContext();
      if (!taskContext) {
        return { isActive: false, questions: [], currentIndex: 0 };
      }

      const state = this.taskStates.get(taskContext.data.id);
      if (!state) {
        return { isActive: false, questions: [], currentIndex: 0 };
      }

      return {
        isActive: state.isActive,
        questions: state.questions,
        currentIndex: state.currentIndex,
        totalQuestions: state.questions.length,
      };
    }
    return undefined;
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId === 'questions-questionnaire') {
      const taskContext = context.getTaskContext();
      if (!taskContext) {
        return { success: false, error: 'No task context' };
      }

      const taskId = taskContext.data.id;
      const state = this.taskStates.get(taskId);

      if (!state) {
        return { success: false, error: 'No questions state' };
      }

      if (action === 'navigate') {
        const direction = args[0] as 'prev' | 'next';
        if (direction === 'prev' && state.currentIndex > 0) {
          state.currentIndex--;
        } else if (direction === 'next' && state.currentIndex < state.questions.length - 1) {
          state.currentIndex++;
        }
        context.triggerUIDataRefresh('questions-questionnaire', taskId);
        return { success: true };
      }

      if (action === 'close') {
        state.isActive = false;
        context.triggerUIDataRefresh('questions-questionnaire', taskId);
        return { success: true };
      }

      if (action === 'submit-answers') {
        const answersArray = args[0] as Array<{ id: string; text: string; answer: string }>;

        if (!answersArray || answersArray.length === 0) {
          taskContext.addLogMessage('warning', 'No answers provided');
          return { success: false, error: 'No answers' };
        }

        const answeredQuestions = answersArray.filter((q) => q.answer && q.answer.trim());
        if (answeredQuestions.length === 0) {
          taskContext.addLogMessage('warning', 'No questions have been answered');
          return { success: false, error: 'No answers' };
        }

        const answersText = answersArray
          .map((q, index) => {
            if (q.answer && q.answer.trim()) {
              return `Q${index + 1}: ${q.text}\nA${index + 1}: ${q.answer}`;
            }
            return null;
          })
          .filter(Boolean)
          .join('\n\n');

        const prompt = `Here are the answers to the questions:\n\n${answersText}`;

        void taskContext.runPrompt(prompt, 'agent');

        state.isActive = false;
        this.taskStates.delete(taskId);

        context.triggerUIDataRefresh('questions-questionnaire', taskId);

        return { success: true };
      }
    }
    return { success: false, error: 'Unknown action' };
  }

  setQuestions(taskId: string, questions: Question[]): void {
    this.taskStates.set(taskId, {
      questions,
      currentIndex: 0,
      isActive: true,
    });
  }
}
