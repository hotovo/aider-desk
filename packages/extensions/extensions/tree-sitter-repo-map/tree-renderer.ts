import * as fs from 'fs/promises';

import { RankedDefinition } from './types';
import logger from './logger';

export class TreeRenderer {
  async render(rankedDefinitions: RankedDefinition[], chatFiles: Set<string>, maxLines?: number): Promise<string> {
    // Filter out chat files
    const filtered = rankedDefinitions.filter((def) => !chatFiles.has(def.rel_fname));

    // Group by file
    const byFile = new Map<string, RankedDefinition[]>();
    for (const def of filtered) {
      const fileDefs = byFile.get(def.rel_fname) || [];
      fileDefs.push(def);
      byFile.set(def.rel_fname, fileDefs);
    }

    // Sort files by highest rank in file
    const sortedFiles = Array.from(byFile.entries()).sort((a, b) => {
      const maxRankA = Math.max(...a[1].map((d) => d.rank));
      const maxRankB = Math.max(...b[1].map((d) => d.rank));
      return maxRankB - maxRankA;
    });

    const totalFiles = sortedFiles.length;

    // If no maxLines specified, render everything
    if (!maxLines) {
      return this.renderAllFiles(sortedFiles);
    }

    // If more files than maxLines, just list filenames
    if (totalFiles > maxLines) {
      return this.renderFileListOnly(sortedFiles, maxLines);
    }

    // Calculate lines per file (at least 2 lines per file: 1 for content + 1 for "..." if truncated)
    // Account for the filename line (1 line per file)
    const headerLines = totalFiles;
    const availableLines = maxLines - headerLines;
    const linesPerFile = Math.max(1, Math.floor(availableLines / totalFiles));

    return this.renderWithLineLimit(sortedFiles, linesPerFile);
  }

  private async renderAllFiles(sortedFiles: [string, RankedDefinition[]][]): Promise<string> {
    let output = '';
    for (const [file, definitions] of sortedFiles) {
      output += `\n${file}:\n`;

      // Sort definitions by line number
      definitions.sort((a, b) => a.line - b.line);

      // Get unique lines and render
      const lines = Array.from(new Set(definitions.map((d) => d.line)));
      const treeLines = await this.renderFileTree(file, lines, Infinity);
      output += treeLines;
    }

    return output.trim();
  }

  private renderFileListOnly(sortedFiles: [string, RankedDefinition[]][], maxLines: number): string {
    let output = '';
    const filesToShow = sortedFiles.slice(0, maxLines - 1); // Reserve 1 line for "..."

    for (const [file] of filesToShow) {
      output += `${file}\n`;
    }

    if (sortedFiles.length > filesToShow.length) {
      output += '...\n';
    }

    return output.trim();
  }

  private async renderWithLineLimit(sortedFiles: [string, RankedDefinition[]][], linesPerFile: number): Promise<string> {
    let output = '';

    for (const [file, definitions] of sortedFiles) {
      // Sort definitions by rank (highest first) then by line number
      definitions.sort((a, b) => {
        if (a.rank !== b.rank) {
          return b.rank - a.rank;
        }
        return a.line - b.line;
      });

      // Get unique lines, limited to linesPerFile
      const uniqueLines = Array.from(new Set(definitions.map((d) => d.line)));
      const limitedLines = uniqueLines.slice(0, linesPerFile);
      const isTruncated = uniqueLines.length > linesPerFile;

      output += `${file}:\n`;

      const treeLines = await this.renderFileTree(file, limitedLines, linesPerFile, isTruncated);
      output += treeLines;
    }

    return output.trim();
  }

  private async renderFileTree(filePath: string, lines: number[], maxLines: number, isTruncated: boolean = false): Promise<string> {
    if (lines.length === 0) {
      return '';
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileLines = content.split('\n');

      let output = '';
      const maxContentLines = isTruncated ? maxLines - 1 : maxLines;
      const linesToRender = lines.slice(0, maxContentLines);

      for (let i = 0; i < linesToRender.length; i++) {
        const lineNum = linesToRender[i];
        const lineContent = fileLines[lineNum]?.trim() || '';

        if (lineContent) {
          // Truncate long lines
          const truncated = lineContent.length > 100 ? lineContent.substring(0, 97) + '...' : lineContent;

          // Determine if this is the last line
          const isLast = i === linesToRender.length - 1 && !isTruncated;
          const prefix = isLast ? '└── ' : '├── ';
          output += `${prefix}${truncated}\n`;
        }
      }

      // Add truncation indicator
      if (isTruncated) {
        output += '└── ...\n';
      }

      return output;
    } catch (error) {
      logger.error(`[TreeRenderer] Error reading file ${filePath}:`, error);
      return '';
    }
  }
}
