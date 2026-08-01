import { beforeEach, describe, expect, it } from 'vitest';

import { useCommitStore } from '../commitStore';

describe('commitStore', () => {
  beforeEach(() => {
    useCommitStore.setState({ committingMap: new Map() });
  });

  it('should mark a task as committing', () => {
    useCommitStore.getState().setCommitting('/project', 'task-1', true);

    expect(useCommitStore.getState().committingMap.get('/project::task-1')).toBe(true);
  });

  it('should clear committing state and not affect other tasks', () => {
    const { setCommitting } = useCommitStore.getState();
    setCommitting('/project', 'task-1', true);
    setCommitting('/project', 'task-2', true);

    setCommitting('/project', 'task-1', false);

    const { committingMap } = useCommitStore.getState();
    expect(committingMap.has('/project::task-1')).toBe(false);
    expect(committingMap.get('/project::task-2')).toBe(true);
  });
});
