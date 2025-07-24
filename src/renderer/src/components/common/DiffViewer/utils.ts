import { tokenize } from 'react-diff-view';
import refractor from 'refractor';
import { HunkData } from 'react-diff-view/types/utils';

export const createTokens = (hunks: HunkData[], language: string) => {
  if (!hunks) {
    return undefined;
  }

  const options = {
    highlight: true,
    refractor,
    language,
  };

  try {
    return tokenize(hunks, options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to tokenize diff hunks:', error);
    return undefined;
  }
};
