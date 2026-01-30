import * as path from 'path';
import * as fs from 'fs';

import logger from '@/logger';
import { isBunBinary, readResource, readBinaryResource } from '@/bun-resources';
import { AIDER_DESK_MCP_SERVER_DIR, MCP_SERVER_FILES } from '@/constants';

/**
 * Copy a resource file from embedded resources (Bun) or filesystem.
 * This abstracts the difference between Bun embedded resources and filesystem access.
 *
 * @param resourcePath Path to the resource (e.g., 'connector/connector.py')
 * @param destPath Destination file path
 * @param isBinary Whether the file should be treated as binary
 */
export const copyResourceFile = async (resourcePath: string, destPath: string, isBinary = false): Promise<void> => {
  if (isBunBinary()) {
    if (isBinary) {
      const buffer = await readBinaryResource(resourcePath);
      if (buffer) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, buffer);
        fs.chmodSync(destPath, 0o755);
      } else {
        throw new Error(`Failed to read binary resource: ${resourcePath}`);
      }
    } else {
      const content = await readResource(resourcePath);
      if (content) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, content);
      } else {
        throw new Error(`Failed to read resource: ${resourcePath}`);
      }
    }
  } else {
    const sourcePath = path.join(process.resourcesPath, resourcePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source resource not found: ${sourcePath}`);
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    if (isBinary) {
      fs.chmodSync(destPath, 0o755);
    }
  }
};

/**
 * Setup MCP server files for Bun binary.
 * Copies all required MCP server files to the data directory.
 */
export const setupMcpServerForBun = async (): Promise<void> => {
  if (!fs.existsSync(AIDER_DESK_MCP_SERVER_DIR)) {
    fs.mkdirSync(AIDER_DESK_MCP_SERVER_DIR, { recursive: true });
  }

  for (const mcpFile of MCP_SERVER_FILES) {
    try {
      const destFilePath = path.join(AIDER_DESK_MCP_SERVER_DIR, path.basename(mcpFile));
      await copyResourceFile(mcpFile, destFilePath);
      logger.debug('[Bun Startup] Copied MCP server file', { mcpFile });
    } catch (error) {
      logger.warn(`[Bun Startup] Could not copy MCP server file: ${mcpFile}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

/**
 * Setup Aider connector for Bun binary.
 * Copies the connector.py file to the data directory.
 */
export const setupAiderConnectorForBun = async (connectorDir: string): Promise<void> => {
  if (!fs.existsSync(connectorDir)) {
    fs.mkdirSync(connectorDir, { recursive: true });
  }

  const destConnectorPath = path.join(connectorDir, 'connector.py');
  await copyResourceFile('connector/connector.py', destConnectorPath);
  logger.debug('[Bun Startup] Copied connector.py');
};
