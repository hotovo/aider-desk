// @ts-ignore - graphology types are incomplete
import Graph from 'graphology';

import { Tag } from './types';
import logger from './logger';

export class GraphBuilder {
  buildDependencyGraph(tags: Tag[]): {
    graph: Graph;
    defines: Map<string, Set<string>>;
    references: Map<string, string[]>;
  } {
    const graph = new Graph({ type: 'directed', allowSelfLoops: false, multi: true });

    const defines = new Map<string, Set<string>>();
    const references = new Map<string, string[]>();
    const definitions = new Map<string, Tag[]>();

    // Build mappings
    for (const tag of tags) {
      if (tag.kind === 'def') {
        if (!defines.has(tag.name)) {
          defines.set(tag.name, new Set());
        }
        defines.get(tag.name)!.add(tag.rel_fname);

        const key = `${tag.rel_fname}:${tag.name}`;
        if (!definitions.has(key)) {
          definitions.set(key, []);
        }
        definitions.get(key)!.push(tag);
      } else if (tag.kind === 'ref') {
        if (!references.has(tag.name)) {
          references.set(tag.name, []);
        }
        references.get(tag.name)!.push(tag.rel_fname);
      }
    }

    // Build graph edges
    const idents = new Set(Array.from(defines.keys()).filter((k) => references.has(k)));

    for (const ident of Array.from(idents)) {
      const definers = Array.from(defines.get(ident) || []);
      const referencers = references.get(ident) || [];

      // Calculate weight multiplier
      let mul = 1.0;
      if (this.isSnakeCase(ident) || this.isKebabCase(ident) || this.isCamelCase(ident)) {
        mul *= 10;
      }
      if (ident.startsWith('_')) {
        mul *= 0.1;
      }
      if (definers.length > 5) {
        mul *= 0.1; // Very common symbol
      }

      // Count references per file
      const refCounts = new Map<string, number>();
      for (const ref of referencers) {
        refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
      }

      // Add edges
      for (const referencer of referencers) {
        const numRefs = refCounts.get(referencer) || 1;
        const weight = mul * Math.sqrt(numRefs);

        for (const definer of definers) {
          if (referencer !== definer) {
            if (!graph.hasNode(referencer)) {
              graph.addNode(referencer);
            }
            if (!graph.hasNode(definer)) {
              graph.addNode(definer);
            }

            const edgeKey = `${referencer}->${definer}:${ident}`;
            if (!graph.hasEdge(edgeKey)) {
              graph.addEdgeWithKey(edgeKey, referencer, definer, { weight, ident });
            }
          }
        }
      }
    }

    logger.info(`[GraphBuilder] Built graph with ${graph.order} nodes and ${graph.size} edges`);

    return { graph, defines, references };
  }

  private isSnakeCase(str: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(str) && str.includes('_');
  }

  private isKebabCase(str: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(str) && str.includes('-');
  }

  private isCamelCase(str: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(str) && /[A-Z]/.test(str);
  }
}
