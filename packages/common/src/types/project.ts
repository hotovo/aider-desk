export type ProjectCheckItem = {
  name: string;
  path: string;
};

export type ProjectCheckResult = {
  agents: ProjectCheckItem[];
  mcpServers: ProjectCheckItem[];
  extensions: ProjectCheckItem[];
};
