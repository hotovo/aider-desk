import { type CompletionResult } from '@codemirror/autocomplete';

export const wordCompletions = (from: number, words: string[], files: string[]): CompletionResult => ({
  from,
  options: [...words, ...files].map((label) => ({ label, type: 'text' })),
  validFor: /^\S*$/,
});
