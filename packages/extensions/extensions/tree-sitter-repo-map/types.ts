export interface Tag {
  rel_fname: string;
  fname: string;
  line: number;
  name: string;
  kind: 'def' | 'ref';
}

export interface RepoMapOptions {
  root: string;
  files?: string[];
  excludePatterns?: string[];
  mentionedFiles?: Set<string>;
  mentionedIdents?: Set<string>;
  chatFiles?: Set<string>;
  maxLines?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  ident: string;
}

export interface RankedDefinition {
  rel_fname: string;
  name: string;
  rank: number;
  line: number;
}
