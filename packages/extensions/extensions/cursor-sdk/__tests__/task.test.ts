import { describe, expect, it } from 'vitest';

import {
  completeCursorTaskPromptContext,
  createCursorTaskPromptContext,
  getCursorTaskConversationSteps,
  getCursorTaskResultValue,
  mapCursorTaskInput,
  mapCursorTaskResult,
} from '../task';

describe('Cursor task mapping', () => {
  const args = {
    description: 'Build Restrictions tab UI',
    prompt: 'Implement the restrictions tab.',
    subagentType: { kind: 'unspecified' },
    model: 'composer-2.5-fast',
  };

  it('maps Cursor task arguments to the AiderDesk subagent tool shape', () => {
    expect(mapCursorTaskInput(args)).toEqual({
      description: 'Build Restrictions tab UI',
      prompt: 'Implement the restrictions tab.',
      subagentId: 'cursor-composer-2.5-fast',
    });
  });

  it('creates a running prompt context and marks it completed', () => {
    const promptContext = createCursorTaskPromptContext(args);
    const completed = completeCursorTaskPromptContext(args, promptContext);

    expect(promptContext.group).toMatchObject({
      color: '#3368a8',
      name: 'Cursor composer-2.5-fast: Build Restrictions tab UI...',
    });
    expect(completed).toMatchObject({
      id: promptContext.id,
      group: {
        id: promptContext.group?.id,
        name: 'Cursor composer-2.5-fast: Build Restrictions tab UI',
        finished: true,
      },
    });
  });

  it('extracts conversation steps from a Cursor task result', () => {
    const steps = [{ type: 'assistantMessage', message: { text: 'Done' } }];

    expect(
      getCursorTaskConversationSteps({
        status: 'success',
        value: { conversationSteps: steps },
      }),
    ).toEqual(steps);
    expect(getCursorTaskConversationSteps({ status: 'success', value: {} })).toEqual([]);
  });

  it('extracts a background task agent and conversation steps from the result', () => {
    const steps = [{ type: 'assistantMessage', message: { text: 'Done' } }];
    const result = {
      status: 'success',
      value: { agentId: 'subagent-1', isBackground: true, conversationSteps: steps },
    };

    expect(getCursorTaskResultValue(result)).toEqual(result.value);
    expect(getCursorTaskConversationSteps(result)).toEqual(steps);
  });

  it('uses the AiderDesk subagent result shape', () => {
    const promptContext = createCursorTaskPromptContext(args);
    const result = mapCursorTaskResult([], promptContext, 'success');

    expect(result.output).toEqual({
      type: 'json',
      value: { messages: [], promptContext },
    });
    expect(JSON.parse(result.resultStr)).toEqual({
      messages: [],
      promptContext,
    });
  });
});
