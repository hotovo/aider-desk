import { LogAction } from './types';

type LogActionsSource = {
  actions?: LogAction[];
  actionIds?: string[];
};

export const getLogActions = ({ actions, actionIds }: LogActionsSource): LogAction[] | undefined => actions ?? actionIds?.map((id) => ({ id }));
