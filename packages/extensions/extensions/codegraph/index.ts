import { z } from 'zod';

import CodeGraphModule from '@colbymchenry/codegraph';
import type { Node, Edge, SearchResult, GraphStats, CodeGraph as CodeGraphType } from '@colbymchenry/codegraph';

import type { Extension, ExtensionContext, ProjectStartedEvent, ProjectStoppedEvent, ToolDefinition } from '@aiderdesk/extensions';

const CodeGraphClass = (CodeGraphModule as unknown as { CodeGraph: typeof CodeGraphType }).CodeGraph;
const isInitialized = (CodeGraphModule as unknown as { isInitialized: (path: string) => boolean }).isInitialized;

interface SearchInput {
  query: string;
  kinds?: string[];
  limit?: number;
}

interface ContextInput {
  task: string;
  maxNodes?: number;
  includeCode?: boolean;
  format?: 'markdown' | 'json';
}

interface TraceInput {
  fromSymbol: string;
  toSymbol: string;
  maxDepth?: number;
}

interface CallersInput {
  symbol: string;
  maxDepth?: number;
}

interface ImpactInput {
  symbol: string;
  depth?: number;
}

interface NodeInput {
  symbol: string;
  includeCode?: boolean;
}

interface ExploreInput {
  query: string;
  maxNodes?: number;
  includeCode?: boolean;
}

interface FilesInput {
  language?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export const metadata = {
  name: 'CodeGraph',
  version: '1.0.0',
  description: 'Code intelligence using CodeGraph — symbol search, call graph tracing, impact analysis, and context building',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/codegraph/icon.png',
  author: 'wladimiiir',
  capabilities: ['tools', 'search'],
};

const instances = new Map<string, CodeGraphType>();
const initPromises = new Map<string, Promise<CodeGraphType>>();

const getOrInitCodeGraph = async (projectDir: string, context: ExtensionContext): Promise<CodeGraphType> => {
  const existing = instances.get(projectDir);
  if (existing) return existing;

  const inProgress = initPromises.get(projectDir);
  if (inProgress) return inProgress;

  if (isInitialized(projectDir)) {
    const cg = await CodeGraphClass.open(projectDir, { sync: true });
    instances.set(projectDir, cg);
    return cg;
  }

  const promise = (async () => {
    try {
      context.getTaskContext()?.addLogMessage('info', 'CodeGraph: Initializing project index for the first time. This may take a moment…');

      const cg = await CodeGraphClass.init(projectDir, {
        index: true,
        onProgress: (p) => {
          context.log(`CodeGraph indexing: ${p.phase} ${p.current}/${p.total}`, 'debug');
        },
      });

      instances.set(projectDir, cg);
      context.getTaskContext()?.addLogMessage('info', 'CodeGraph: Project indexed successfully.');
      return cg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      context.log(`CodeGraph init failed: ${msg}`, 'error');
      throw new Error(`CodeGraph initialization failed: ${msg}`);
    } finally {
      initPromises.delete(projectDir);
    }
  })();

  initPromises.set(projectDir, promise);
  return promise;
};

const textResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
});

const errorResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  isError: true,
});

const formatNode = (node: Node): string => {
  const parts = [`**${node.name}** (${node.kind})`];
  parts.push(`  File: ${node.filePath}:${node.startLine}-${node.endLine}`);
  if (node.signature) parts.push(`  Signature: ${node.signature}`);
  if (node.visibility) parts.push(`  Visibility: ${node.visibility}`);
  if (node.isAsync) parts.push('  Async: true');
  if (node.isStatic) parts.push('  Static: true');
  if (node.isExported) parts.push('  Exported: true');
  if (node.docstring) parts.push(`  Doc: ${node.docstring}`);
  return parts.join('\n');
};

const formatSearchResults = (results: SearchResult[]): string => {
  if (results.length === 0) return 'No symbols found.';

  const lines: string[] = [`Found ${results.length} symbol(s):\n`];
  for (const r of results) {
    lines.push(`- **${r.node.name}** (${r.node.kind}) — ${r.node.filePath}:${r.node.startLine} [score: ${r.score.toFixed(2)}]`);
    if (r.node.signature) lines.push(`  \`${r.node.signature}\``);
  }
  return lines.join('\n');
};

const formatCallList = (items: Array<{ node: Node; edge: Edge }>, direction: 'callers' | 'callees'): string => {
  if (items.length === 0) return `No ${direction} found.`;

  const lines: string[] = [`${direction.charAt(0).toUpperCase() + direction.slice(1)} (${items.length}):\n`];
  for (const item of items) {
    const loc = item.edge.line ? ` at line ${item.edge.line}` : '';
    lines.push(`- **${item.node.name}** (${item.node.kind}) — ${item.node.filePath}:${item.node.startLine}${loc}`);
  }
  return lines.join('\n');
};

const formatImpact = (nodes: Map<string, Node>, edges: Edge[], rootId: string, depth: number): string => {
  if (nodes.size === 0) return 'No impacted symbols found.';

  const lines: string[] = [`Impact radius (depth ${depth}): ${nodes.size} symbol(s) affected\n`];
  for (const [id, node] of nodes) {
    const prefix = id === rootId ? '⬆️ ' : '  ';
    lines.push(`${prefix}**${node.name}** (${node.kind}) — ${node.filePath}:${node.startLine}`);
  }
  if (edges.length > 0) {
    lines.push(`\nRelationships: ${edges.length} edge(s)`);
  }
  return lines.join('\n');
};

const formatStats = (stats: GraphStats): string => {
  const lines: string[] = [
    '## CodeGraph Index Status\n',
    `- **Nodes:** ${stats.nodeCount}`,
    `- **Edges:** ${stats.edgeCount}`,
    `- **Files:** ${stats.fileCount}`,
    `- **DB Size:** ${(stats.dbSizeBytes / 1024).toFixed(1)} KB`,
    '',
    '### Nodes by Kind',
  ];
  for (const [kind, count] of Object.entries(stats.nodesByKind)) {
    if (count > 0) lines.push(`- ${kind}: ${count}`);
  }
  lines.push('\n### Edges by Kind');
  for (const [kind, count] of Object.entries(stats.edgesByKind)) {
    if (count > 0) lines.push(`- ${kind}: ${count}`);
  }
  lines.push('\n### Files by Language');
  for (const [lang, count] of Object.entries(stats.filesByLanguage)) {
    if (count > 0) lines.push(`- ${lang}: ${count}`);
  }
  return lines.join('\n');
};

export default class CodeGraphExtension implements Extension {
  static metadata = metadata;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('CodeGraph extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    for (const cg of instances.values()) {
      cg.close();
    }
    instances.clear();
    initPromises.clear();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    context.log(`CodeGraph: Project started at ${event.baseDir}`, 'debug');
  }

  async onProjectStopped(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void> {
    const cg = instances.get(event.baseDir);
    if (cg) {
      cg.unwatch();
      cg.close();
      instances.delete(event.baseDir);
    }
    initPromises.delete(event.baseDir);
  }

  getTools(_context: ExtensionContext, _mode: string): ToolDefinition[] {
    return [
      {
        name: 'codegraph-search',
        description:
          'Find symbols by name across the codebase using CodeGraph. Returns matching symbols with kind, location, and signature. Use this instead of grep for symbol lookups — it is faster and returns structured results. For understanding an area or "how does X work", prefer codegraph-explore instead.',
        inputSchema: z.object({
          query: z.string().describe('The symbol name or pattern to search for.'),
          kinds: z.array(z.string()).optional().describe('Filter by node kinds (e.g., ["function", "method", "class"]).'),
          limit: z.number().optional().describe('Maximum results to return. Default: 20.'),
        }),
        execute: async (input, _signal, context) => {
          const { query, kinds, limit } = input as unknown as SearchInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);
          const results = cg.searchNodes(query, {
            kinds: kinds as Node['kind'][] | undefined,
            limit: limit ?? 20,
          });
          return textResult(formatSearchResults(results));
        },
      },
      {
        name: 'codegraph-context',
        description:
          'Build relevant code context for a task using CodeGraph. Combines search + graph traversal + code extraction into one call. Returns markdown or JSON context suitable for AI consumption. This is the fastest way to get comprehensive context about a code area.',
        inputSchema: z.object({
          task: z.string().describe('Natural language description of the task or question.'),
          maxNodes: z.number().optional().describe('Maximum nodes to include. Default: 50.'),
          includeCode: z.boolean().optional().describe('Whether to include source code blocks. Default: true.'),
          format: z.enum(['markdown', 'json']).optional().describe('Output format. Default: markdown.'),
        }),
        execute: async (input, _signal, context) => {
          const { task, maxNodes, includeCode, format } = input as unknown as ContextInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);
          const result = await cg.buildContext(task, {
            maxNodes,
            includeCode: includeCode ?? true,
            format: format ?? 'markdown',
          });
          if (typeof result === 'string') return textResult(result);
          return textResult(JSON.stringify(result, null, 2));
        },
      },
      {
        name: 'codegraph-trace',
        description:
          'Trace the call path between two symbols using CodeGraph. Shows how symbol X reaches symbol Y, including each hop with its source. Follows dynamic-dispatch paths (callbacks, React re-renders, interface→implementation) that grep cannot trace.',
        inputSchema: z.object({
          fromSymbol: z.string().describe('The starting symbol name or qualified name.'),
          toSymbol: z.string().describe('The target symbol name or qualified name.'),
          maxDepth: z.number().optional().describe('Maximum traversal depth. Default: 5.'),
        }),
        execute: async (input, _signal, context) => {
          const { fromSymbol, toSymbol } = input as unknown as TraceInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const fromResults = cg.searchNodes(fromSymbol, { limit: 5 });
          if (fromResults.length === 0) {
            return errorResult(`Symbol "${fromSymbol}" not found.`);
          }

          const toResults = cg.searchNodes(toSymbol, { limit: 5 });
          if (toResults.length === 0) {
            return errorResult(`Symbol "${toSymbol}" not found.`);
          }

          const fromNode = fromResults[0];
          const toNode = toResults[0];

          const path = cg.findPath(fromNode.node.id, toNode.node.id);

          if (!path) {
            return textResult(`No path found from "${fromSymbol}" to "${toSymbol}".`);
          }

          const lines: string[] = [`Path from **${fromNode.node.name}** to **${toNode.node.name}** (${path.length} hop(s)):\n`];
          for (let i = 0; i < path.length; i++) {
            const step = path[i];
            const prefix = i === 0 ? '➡️' : '  ↳';
            lines.push(`${prefix} **${step.node.name}** (${step.node.kind}) — ${step.node.filePath}:${step.node.startLine}`);
            if (step.edge) {
              lines.push(`    via ${step.edge.kind}${step.edge.line ? ` at line ${step.edge.line}` : ''}`);
            }
          }
          return textResult(lines.join('\n'));
        },
      },
      {
        name: 'codegraph-callers',
        description:
          'Find what calls a function/method using CodeGraph. Returns callers with their locations. For deeper analysis use codegraph-impact. For understanding an area, prefer codegraph-explore.',
        inputSchema: z.object({
          symbol: z.string().describe('The function or method name to find callers for.'),
          maxDepth: z.number().optional().describe('Maximum depth to traverse. Default: 1.'),
        }),
        execute: async (input, _signal, context) => {
          const { symbol, maxDepth } = input as unknown as CallersInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const results = cg.searchNodes(symbol, { limit: 10 });
          if (results.length === 0) {
            return errorResult(`Symbol "${symbol}" not found.`);
          }

          const allCallers: Array<{ node: Node; edge: Edge }> = [];
          for (const r of results) {
            const callers = cg.getCallers(r.node.id, maxDepth ?? 1);
            allCallers.push(...callers);
          }

          return textResult(formatCallList(allCallers, 'callers'));
        },
      },
      {
        name: 'codegraph-callees',
        description:
          'Find what a function/method calls using CodeGraph. Returns callees with their locations. For understanding an area, prefer codegraph-explore.',
        inputSchema: z.object({
          symbol: z.string().describe('The function or method name to find callees for.'),
          maxDepth: z.number().optional().describe('Maximum depth to traverse. Default: 1.'),
        }),
        execute: async (input, _signal, context) => {
          const { symbol, maxDepth } = input as unknown as CallersInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const results = cg.searchNodes(symbol, { limit: 10 });
          if (results.length === 0) {
            return errorResult(`Symbol "${symbol}" not found.`);
          }

          const allCallees: Array<{ node: Node; edge: Edge }> = [];
          for (const r of results) {
            const callees = cg.getCallees(r.node.id, maxDepth ?? 1);
            allCallees.push(...callees);
          }

          return textResult(formatCallList(allCallees, 'callees'));
        },
      },
      {
        name: 'codegraph-impact',
        description:
          'Analyze what code is affected by changing a symbol using CodeGraph. Returns the transitive impact radius — all symbols that could be affected. Useful for refactoring planning and regression risk assessment.',
        inputSchema: z.object({
          symbol: z.string().describe('The symbol name to analyze impact for.'),
          depth: z.number().optional().describe('Maximum depth to traverse. Default: 3.'),
        }),
        execute: async (input, _signal, context) => {
          const { symbol, depth } = input as unknown as ImpactInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const results = cg.searchNodes(symbol, { limit: 5 });
          if (results.length === 0) {
            return errorResult(`Symbol "${symbol}" not found.`);
          }

          const effectiveDepth = depth ?? 3;
          const subgraph = cg.getImpactRadius(results[0].node.id, effectiveDepth);
          return textResult(formatImpact(subgraph.nodes, subgraph.edges, results[0].node.id, effectiveDepth));
        },
      },
      {
        name: 'codegraph-node',
        description:
          'Get details about a specific symbol using CodeGraph. Returns the symbol metadata and optionally its source code. For an ambiguous name, returns ALL matching definitions so you never need to Read a file to find the right overload. For exploring an area, prefer codegraph-explore.',
        inputSchema: z.object({
          symbol: z.string().describe('The symbol name or qualified name to look up.'),
          includeCode: z.boolean().optional().describe('Whether to include the source code. Default: false.'),
        }),
        execute: async (input, _signal, context) => {
          const { symbol, includeCode } = input as unknown as NodeInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const results = cg.searchNodes(symbol, { limit: 10 });
          if (results.length === 0) {
            return errorResult(`Symbol "${symbol}" not found.`);
          }

          const lines: string[] = [];
          for (const r of results) {
            lines.push(formatNode(r.node));

            if (includeCode) {
              const code = await cg.getCode(r.node.id);
              if (code) {
                lines.push(`\n\`\`\`${r.node.language}`);
                lines.push(code);
                lines.push('```');
              }
            }

            const callers = cg.getCallers(r.node.id, 1);
            const callees = cg.getCallees(r.node.id, 1);
            if (callers.length > 0 || callees.length > 0) {
              lines.push('\nTrail:');
              if (callers.length > 0) {
                lines.push(`  Called by: ${callers.map((c) => `${c.node.name} (${c.node.filePath}:${c.node.startLine})`).join(', ')}`);
              }
              if (callees.length > 0) {
                lines.push(`  Calls: ${callees.map((c) => `${c.node.name} (${c.node.filePath}:${c.node.startLine})`).join(', ')}`);
              }
            }

            lines.push('---');
          }
          return textResult(lines.join('\n'));
        },
      },
      {
        name: 'codegraph-explore',
        description:
          'Deep exploration of related symbols in one call using CodeGraph. Takes a natural-language query or a bag of symbol/file names and returns the source of relevant symbols grouped by file. This is the primary CodeGraph tool — ONE call usually answers the whole question. Replaces multiple codegraph-node + Read calls.',
        inputSchema: z.object({
          query: z.string().describe('Natural language query or space-separated symbol names describing what to explore.'),
          maxNodes: z.number().optional().describe('Maximum nodes to include. Default: 50.'),
          includeCode: z.boolean().optional().describe('Whether to include source code. Default: true.'),
        }),
        execute: async (input, _signal, context) => {
          const { query, maxNodes, includeCode } = input as unknown as ExploreInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const result = await cg.buildContext(query, {
            maxNodes: maxNodes ?? 50,
            includeCode: includeCode ?? true,
            format: 'markdown',
          });

          if (typeof result === 'string') return textResult(result);

          const tc = result as {
            query: string;
            summary: string;
            subgraph: { nodes: Map<string, Node>; edges: Edge[]; roots: string[] };
            codeBlocks: Array<{ content: string; filePath: string; startLine: number; endLine: number; language: string }>;
            relatedFiles: string[];
            stats: { nodeCount: number; edgeCount: number; fileCount: number };
          };

          const lines: string[] = [];
          lines.push(`## CodeGraph Explore: ${tc.query}\n`);
          lines.push(`${tc.summary}\n`);

          if (tc.codeBlocks.length > 0) {
            lines.push('### Source Code\n');
            for (const block of tc.codeBlocks) {
              lines.push(`#### ${block.filePath}:${block.startLine}-${block.endLine}\n`);
              lines.push(`\`\`\`${block.language}`);
              lines.push(block.content);
              lines.push('```\n');
            }
          }

          if (tc.relatedFiles.length > 0) {
            lines.push('### Related Files\n');
            for (const f of tc.relatedFiles) {
              lines.push(`- ${f}`);
            }
          }

          lines.push(`\n### Stats: ${tc.stats.nodeCount} nodes, ${tc.stats.edgeCount} edges, ${tc.stats.fileCount} files`);
          return textResult(lines.join('\n'));
        },
      },
      {
        name: 'codegraph-files',
        description:
          'Get the indexed file structure from CodeGraph. Returns files with their languages and node counts. Faster than filesystem scanning. Use codegraph-status for index health info.',
        inputSchema: z.object({
          language: z.string().optional().describe('Filter by language (e.g., "typescript", "python").'),
          includePatterns: z.array(z.string()).optional().describe('File path patterns to include (glob).'),
          excludePatterns: z.array(z.string()).optional().describe('File path patterns to exclude (glob).'),
        }),
        execute: async (input, _signal, context) => {
          const { language, includePatterns, excludePatterns } = input as unknown as FilesInput;
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const files = cg.getFiles();
          let filtered = files;

          if (language) {
            filtered = filtered.filter((f) => f.language === language);
          }
          if (includePatterns) {
            for (const pattern of includePatterns) {
              const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
              filtered = filtered.filter((f) => regex.test(f.path));
            }
          }
          if (excludePatterns) {
            for (const pattern of excludePatterns) {
              const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
              filtered = filtered.filter((f) => !regex.test(f.path));
            }
          }

          if (filtered.length === 0) {
            return textResult('No indexed files found matching the criteria.');
          }

          const langGroups: Record<string, string[]> = {};
          for (const f of filtered) {
            if (!langGroups[f.language]) langGroups[f.language] = [];
            langGroups[f.language].push(`  ${f.path} (${f.nodeCount} symbols)`);
          }

          const lines: string[] = [`Indexed files (${filtered.length} total)\n`];
          for (const [lang, paths] of Object.entries(langGroups).sort()) {
            lines.push(`### ${lang} (${paths.length} file(s))`);
            lines.push(paths.join('\n'));
            lines.push('');
          }
          return textResult(lines.join('\n'));
        },
      },
      {
        name: 'codegraph-status',
        description:
          'Check CodeGraph index health and statistics. Returns node/edge/file counts, database size, and language breakdown. Use this to verify the index is ready before running queries.',
        inputSchema: z.object({}),
        execute: async (_input, _signal, context) => {
          const projectDir = context.getProjectDir();
          const cg = await getOrInitCodeGraph(projectDir, context);

          const stats = cg.getStats();
          const isWatching = cg.isWatching();
          const isIndexing = cg.isIndexing();

          const result = formatStats(stats);
          const extra = [`\n- **Watcher:** ${isWatching ? 'active' : 'inactive'}`, `- **Indexing:** ${isIndexing ? 'in progress' : 'idle'}`];
          return textResult(result + extra.join('\n'));
        },
      },
    ];
  }
}
