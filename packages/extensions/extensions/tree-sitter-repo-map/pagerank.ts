// @ts-ignore - graphology types are incomplete
import Graph from 'graphology';
// @ts-ignore - graphology-metrics types are incomplete
import pagerank from 'graphology-metrics/centrality/pagerank';

import { RankedDefinition, Tag } from './types';
import logger from './logger';

export class PageRankCalculator {
  calculate(graph: Graph, tags: Tag[], mentionedFiles?: Set<string>, mentionedIdents?: Set<string>): RankedDefinition[] {
    if (graph.order === 0) {
      return [];
    }

    // Build personalization vector
    const personalization: Record<string, number> = {};
    const nodes = graph.nodes();
    const personalize = nodes.length > 0 ? 100 / nodes.length : 0;

    for (const node of nodes) {
      let score = 0;
      if (mentionedFiles?.has(node)) {
        score += personalize;
      }
      if (mentionedIdents) {
        // Check if any mentioned ident is defined in this file
        const fileTags = tags.filter((t) => t.rel_fname === node && t.kind === 'def');
        if (fileTags.some((t) => mentionedIdents.has(t.name))) {
          score += personalize;
        }
      }
      if (score > 0) {
        personalization[node] = score;
      }
    }

    try {
      // Calculate PageRank
      const pagerankOptions: Record<string, unknown> = {
        alpha: 0.85,
        maxIterations: 100,
        tolerance: 1e-6,
      };

      if (Object.keys(personalization).length > 0) {
        pagerankOptions.personalization = personalization;
      }

      const ranks = pagerank(graph, pagerankOptions as Parameters<typeof pagerank>[1]);

      // Distribute rank across definitions
      const rankedDefinitions: RankedDefinition[] = [];
      const definitions = tags.filter((t) => t.kind === 'def');

      for (const def of definitions) {
        const nodeRank = ranks[def.rel_fname] || 0;

        // Calculate edge contribution
        let edgeRank = nodeRank;
        if (graph.hasNode(def.rel_fname)) {
          graph.forEachOutboundEdge(def.rel_fname, (edge) => {
            const weight = graph.getEdgeAttribute(edge, 'weight') as number;
            const totalWeight = this.getTotalOutboundWeight(graph, def.rel_fname);
            if (totalWeight > 0) {
              edgeRank += nodeRank * (weight / totalWeight);
            }
          });
        }

        rankedDefinitions.push({
          rel_fname: def.rel_fname,
          name: def.name,
          rank: edgeRank,
          line: def.line,
        });
      }

      // Sort by rank
      rankedDefinitions.sort((a, b) => b.rank - a.rank);

      logger.info(`[PageRankCalculator] Calculated ranks for ${rankedDefinitions.length} definitions`);

      return rankedDefinitions;
    } catch (error) {
      logger.error('[PageRankCalculator] Error calculating PageRank:', error);
      return [];
    }
  }

  private getTotalOutboundWeight(graph: Graph, node: string): number {
    if (!graph.hasNode(node)) {
      return 0;
    }
    let total = 0;
    graph.forEachOutboundEdge(node, (edge) => {
      total += (graph.getEdgeAttribute(edge, 'weight') as number) || 1;
    });
    return total;
  }
}
