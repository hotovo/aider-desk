import * as fs from 'fs';
import * as path from 'path';

import { MemoryConfig, MemoryEmbeddingProgress, MemoryEmbeddingProgressPhase, MemoryEntry, MemoryEntryType, SettingsData } from '@common/types';
import { v4 as uuidv4 } from 'uuid';

import type { FeatureExtractionPipeline } from '@huggingface/transformers';

import { AIDER_DESK_CACHE_DIR, AIDER_DESK_MEMORY_FILE } from '@/constants';
import logger from '@/logger';
import { Store } from '@/store';

type LanceDbModule = typeof import('@lancedb/lancedb');
type TransformersModule = typeof import('@huggingface/transformers');

export class MemoryManager {
  private lancedb: LanceDbModule | null = null;
  private transformers: TransformersModule | null = null;

  private db: import('@lancedb/lancedb').Connection | null = null;
  private table: import('@lancedb/lancedb').Table | null = null;
  private embeddingPipelinePromise: Promise<FeatureExtractionPipeline | null> | null = null;
  private isInitialized = false;
  private readonly tableName = 'memories';

  private embeddingProgress: MemoryEmbeddingProgress = {
    phase: MemoryEmbeddingProgressPhase.Idle,
    status: null,
    done: 0,
    total: 0,
    finished: true,
  };

  constructor(private readonly store: Store) {}

  /**
   * Checks if an error indicates a corrupted or incomplete model file.
   */
  private isCorruptedModelError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('protobuf parsing failed') ||
      errorMessage.includes('failed to load model') ||
      errorMessage.includes('invalid model') ||
      errorMessage.includes('corrupted') ||
      errorMessage.includes('unexpected end of file') ||
      errorMessage.includes('invalid file')
    );
  }

  /**
   * Deletes the cached model directory for a given model name.
   */
  private async deleteModelCache(modelName: string): Promise<void> {
    try {
      const modelCacheDir = path.join(AIDER_DESK_CACHE_DIR, ...modelName.split('/'));
      if (fs.existsSync(modelCacheDir)) {
        logger.info(`Deleting corrupted model cache at: ${modelCacheDir}`);
        await fs.promises.rm(modelCacheDir, { recursive: true, force: true });
        logger.info('Model cache deleted successfully');
      }
    } catch (error) {
      logger.error('Failed to delete model cache:', error);
    }
  }

  /**
   * Loads the embedding pipeline with retry logic for corrupted models.
   * If the model fails to load due to corruption, it will delete the cache and retry once.
   */
  private async loadEmbeddingPipelineWithRetry(modelName: string): Promise<FeatureExtractionPipeline | null> {
    if (!this.transformers) {
      return null;
    }

    const attemptLoad = async (): Promise<FeatureExtractionPipeline | null> => {
      const pipeline = await this.transformers!.pipeline('feature-extraction', modelName, {
        cache_dir: AIDER_DESK_CACHE_DIR,
        progress_callback: (progress) => {
          // @ts-expect-error progress is not typed properly
          const status = `${Number(progress.progress).toFixed(2)}%`;
          if (status) {
            this.embeddingProgress.status = status;
          }
        },
      });
      return pipeline as FeatureExtractionPipeline;
    };

    try {
      const pipeline = await attemptLoad();
      this.isInitialized = true;
      this.embeddingProgress = {
        phase: MemoryEmbeddingProgressPhase.Done,
        status: this.embeddingProgress.status,
        done: this.embeddingProgress.total,
        total: this.embeddingProgress.total,
        finished: true,
      };
      return pipeline;
    } catch (error) {
      // Check if this is a corrupted model error
      if (this.isCorruptedModelError(error)) {
        logger.warn('Detected corrupted model cache, deleting and retrying...', {
          error: error instanceof Error ? error.message : String(error),
        });

        // Delete the corrupted cache
        await this.deleteModelCache(modelName);

        // Retry loading
        try {
          logger.info('Retrying model download after clearing cache...');
          const pipeline = await attemptLoad();
          this.isInitialized = true;
          this.embeddingProgress = {
            phase: MemoryEmbeddingProgressPhase.Done,
            status: this.embeddingProgress.status,
            done: this.embeddingProgress.total,
            total: this.embeddingProgress.total,
            finished: true,
          };
          logger.info('Model successfully loaded after retry');
          return pipeline;
        } catch (retryError) {
          logger.error('Failed to load model even after clearing cache:', retryError);
          this.embeddingProgress = {
            phase: MemoryEmbeddingProgressPhase.Error,
            status: this.embeddingProgress.status,
            done: this.embeddingProgress.done,
            total: this.embeddingProgress.total,
            finished: true,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          };
          return null;
        }
      } else {
        // Non-corruption error, just log and fail
        logger.error('Failed to load local embedding model:', error);
        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.Error,
          status: this.embeddingProgress.status,
          done: this.embeddingProgress.done,
          total: this.embeddingProgress.total,
          finished: true,
          error: error instanceof Error ? error.message : String(error),
        };
        return null;
      }
    }
  }

  /**
   * Initialize the database connection and the local embedding model.
   * This must be called before using other methods.
   */
  public async init(config: MemoryConfig = this.store.getSettings().memory): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (!config.enabled) {
        logger.info('Memory system is disabled');
        return;
      }

      // 1. Initialize the Database
      // Ensure directory exists
      if (!fs.existsSync(AIDER_DESK_MEMORY_FILE)) {
        fs.mkdirSync(AIDER_DESK_MEMORY_FILE, { recursive: true });
      }

      if (!this.lancedb) {
        try {
          this.lancedb = await import('@lancedb/lancedb');
        } catch (error) {
          logger.error('Failed to load LanceDB module. Memory features will be unavailable.', error);
          return;
        }
      }

      this.db = await this.lancedb.connect(AIDER_DESK_MEMORY_FILE);

      // Check if table exists, if not, we create it lazily on the first add
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        this.table = await this.db.openTable(this.tableName);
      }

      // 2. Initialize Local Embedding Model (Singleton pattern for the pipeline)
      if (!this.embeddingPipelinePromise) {
        logger.info('Loading local embedding model... (this may take a moment on first run)');
        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.LoadingModel,
          status: null,
          done: 0,
          total: 0,
          finished: false,
        };

        if (!this.transformers) {
          try {
            this.transformers = await import('@huggingface/transformers');
          } catch (error) {
            this.embeddingProgress = {
              phase: MemoryEmbeddingProgressPhase.Error,
              status: this.embeddingProgress.status,
              done: this.embeddingProgress.done,
              total: this.embeddingProgress.total,
              finished: true,
              error: 'Failed to load @huggingface/transformers. This is usually a packaging issue with native dependencies (e.g. sharp/libvips).',
            };
            logger.error('Failed to load transformers module. Memory embedding will be unavailable.', error);
            return;
          }
        }

        this.embeddingPipelinePromise = this.loadEmbeddingPipelineWithRetry(config.model);
      }

      logger.info('Memory manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize memory manager:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  getProgress(): MemoryEmbeddingProgress {
    return this.embeddingProgress;
  }

  private async waitForInit(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    if (this.embeddingPipelinePromise) {
      await this.embeddingPipelinePromise;
    }
    return this.isInitialized;
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData): Promise<void> {
    const oldProvider = oldSettings.memory.provider;
    const oldModel = oldSettings.memory.model;
    const newProvider = newSettings.memory.provider;
    const newModel = newSettings.memory.model;

    if (!oldSettings.memory.enabled && newSettings.memory.enabled && !this.isInitialized) {
      // init with old settings before migration
      await this.init({
        ...oldSettings.memory,
        enabled: true,
      });
      await this.waitForInit();
    }

    const embeddingConfigChanged = oldProvider !== newProvider || oldModel !== newModel;
    if (!embeddingConfigChanged) {
      return;
    }

    logger.info('Memory embedding settings changed. Reloading embedding pipeline and re-embedding stored memories...', {
      oldProvider,
      oldModel,
      newProvider,
      newModel,
    });

    this.embeddingProgress = {
      phase: MemoryEmbeddingProgressPhase.LoadingModel,
      status: null,
      done: 0,
      total: 0,
      finished: false,
    };

    this.isInitialized = false;

    const migrate = async () => {
      if (!this.embeddingPipelinePromise) {
        logger.info('No embedding pipeline promise found during migration, skipping');
        return;
      }

      await this.embeddingPipelinePromise;

      if (!this.db) {
        logger.info('No database connection found during migration, skipping');
        try {
          if (!fs.existsSync(AIDER_DESK_MEMORY_FILE)) {
            fs.mkdirSync(AIDER_DESK_MEMORY_FILE, { recursive: true });
          }
          if (!this.lancedb) {
            this.lancedb = await import('@lancedb/lancedb');
          }
          this.db = await this.lancedb.connect(AIDER_DESK_MEMORY_FILE);
        } catch (error) {
          logger.error('Failed to connect memory DB during migration:', error);
          return;
        }
      }

      if (!this.table) {
        logger.info('No memory table found during migration, skipping');
        try {
          const tableNames = await this.db.tableNames();
          if (!tableNames.includes(this.tableName)) {
            return;
          }
          this.table = await this.db.openTable(this.tableName);
        } catch (error) {
          logger.error('Failed to open memory table during migration:', error);
          return;
        }
      }

      try {
        const rows = await this.table.query().select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid']).toArray();

        if (rows.length === 0) {
          this.embeddingProgress = {
            phase: MemoryEmbeddingProgressPhase.Done,
            status: this.embeddingProgress.status,
            done: 0,
            total: 0,
            finished: true,
          };
          logger.info('No memories to re-embed');
          return;
        }

        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.ReEmbedding,
          status: this.embeddingProgress.status,
          done: 0,
          total: rows.length,
          finished: false,
        };

        const memories = rows.map((row) => ({
          id: row.id as string,
          content: row.content as string,
          type: row.type as string,
          timestamp: row.timestamp as number,
          projectid: row.projectid as string,
          taskid: row.taskid as string,
        }));

        const firstVector = await this.getEmbedding(memories[0].content);
        const vectorDimension = firstVector.length;

        const placeholderVector = new Array(vectorDimension).fill(0);
        const memoriesWithPlaceholder = memories.map((m) => ({
          ...m,
          vector: placeholderVector,
        }));

        await this.db.dropTable(this.tableName);
        this.table = await this.db.createTable(this.tableName, memoriesWithPlaceholder);
        logger.info('Created new table with placeholder vectors', { count: memories.length, vectorDimension });

        await this.table.update({
          where: `id = '${memories[0].id}'`,
          values: { vector: firstVector },
        });
        this.embeddingProgress.done = 1;

        for (let i = 1; i < memories.length; i++) {
          const memory = memories[i];
          const vector = await this.getEmbedding(memory.content);
          await this.table.update({ where: `id = '${memory.id}'`, values: { vector } });

          this.embeddingProgress.done = i + 1;

          if ((i + 1) % 50 === 0) {
            logger.info('Re-embedding memories progress', { done: i + 1, total: memories.length });
          }
        }

        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.Done,
          status: this.embeddingProgress.status,
          done: memories.length,
          total: memories.length,
          finished: true,
        };

        logger.info('Re-embedding memories completed', { total: memories.length });
      } catch (error) {
        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.Error,
          status: this.embeddingProgress.status,
          done: this.embeddingProgress.done,
          total: this.embeddingProgress.total,
          finished: true,
          error: error instanceof Error ? error.message : String(error),
        };
        logger.error('Failed to re-embed memories:', error);
      }
    };

    logger.info('Loading local embedding model... (this may take a moment on first run)');
    if (!this.transformers) {
      try {
        this.transformers = await import('@huggingface/transformers');
      } catch (error) {
        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.Error,
          status: this.embeddingProgress.status,
          done: this.embeddingProgress.done,
          total: this.embeddingProgress.total,
          finished: true,
          error: 'Failed to load @huggingface/transformers. This is usually a packaging issue with native dependencies (e.g. sharp/libvips).',
        };
        logger.error('Failed to load transformers module. Memory embedding will be unavailable.', error);
        return;
      }
    }

    this.embeddingPipelinePromise = this.loadEmbeddingPipelineWithRetry(newModel).then(async (p) => {
      if (p) {
        this.embeddingProgress = {
          phase: MemoryEmbeddingProgressPhase.ReEmbedding,
          status: this.embeddingProgress.status,
          done: this.embeddingProgress.total,
          total: this.embeddingProgress.total,
          finished: true,
        };
      }
      return p;
    });

    await migrate();
  }

  /**
   * Generates a vector embedding for the given text using the local model.
   */
  private async getEmbedding(text: string): Promise<number[]> {
    await this.waitForInit();

    if (!this.isInitialized) {
      logger.error('Embedding pipeline not initialized. Call initialize() first.');
      throw new Error('Embedding pipeline not initialized. Call initialize() first.');
    }

    const pipeline = await this.embeddingPipelinePromise;
    if (!pipeline) {
      logger.error('Embedding pipeline not initialized. Call initialize() first.');
      throw new Error('Embedding pipeline not initialized. Call initialize() first.');
    }

    // Generate embedding
    // pooling: 'mean' averages the token vectors to get a single sentence vector
    // normalize: true ensures the vector is unit length for cosine similarity
    const result = await pipeline(text, { pooling: 'mean', normalize: true });

    // Convert Float32Array to standard number array for LanceDB
    return Array.from(result.data);
  }

  /**
   * Creates and stores a new memory for a specific project.
   */
  async storeMemory(projectId: string, taskId: string, type: MemoryEntryType, content: string) {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db) {
      return;
    }

    try {
      const embedding = await this.getEmbedding(content);

      const memoryWithVector = {
        id: uuidv4(),
        type,
        content,
        taskid: taskId,
        projectid: projectId,
        timestamp: Date.now(),
        vector: embedding,
      };

      if (!this.table) {
        // Create the table if it doesn't exist yet
        this.table = await this.db.createTable(this.tableName, [memoryWithVector]);
      } else {
        // Add to existing table
        await this.table.add([memoryWithVector]);
      }

      logger.debug('Stored memory entry', {
        id: memoryWithVector.id,
        type: memoryWithVector.type,
        projectId: memoryWithVector.projectid,
        taskId: memoryWithVector.taskid,
        content: memoryWithVector.content.substring(0, 100),
      });
    } catch (error) {
      logger.error('Failed to store memory:', error);
    }
  }

  /**
   * Retrieves memories for a specific project relevant to the user's query.
   * @param projectId - The project to filter by
   * @param query - The user's search query
   * @param limit - Max number of memories to return (default 5)
   */
  async retrieveMemories(projectId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db) {
      return [];
    }

    if (!this.table) {
      return []; // No memories exist yet
    }

    const maxDistance = this.store.getSettings().memory.maxDistance;

    logger.info('Retrieving memories', {
      projectId,
      query,
      limit,
      maxDistance,
    });
    const queryVector = await this.getEmbedding(query);

    // Perform Vector Search + SQL Filtering with distance information
    const results = await this.table
      .query()
      .nearestTo(queryVector) // Vector similarity search
      .where(`projectid = '${projectId}'`) // SQL-like filtering for the project
      .limit(limit)
      .select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid', '_distance'])
      .toArray();

    logger.info('Retrieved memories', {
      projectId,
      query,
      limit,
      maxDistance,
      count: results.length,
      distances: results.map((result) => result._distance),
    });

    const filteredResults = results.filter((result) => (result._distance as number) <= maxDistance);

    // Map results back to MemoryEntry interface
    // Note: LanceDB returns rows, we cast them to our interface
    return filteredResults.map((result) => {
      return {
        id: result.id as string,
        content: result.content as string,
        type: result.type as MemoryEntryType,
        timestamp: result.timestamp as number,
        projectId: result.projectid as string,
        taskId: result.taskid as string,
      };
    });
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return null;
    }

    try {
      const results = await this.table.query().where(`id = '${id}'`).select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid']).limit(1).toArray();

      if (results.length === 0) {
        return null;
      }

      const result = results[0];
      return {
        id: result.id as string,
        content: result.content as string,
        type: result.type as MemoryEntryType,
        timestamp: result.timestamp as number,
        projectId: result.projectid as string,
        taskId: result.taskid as string,
      };
    } catch (error) {
      logger.error('Failed to get memory:', error);
      return null;
    }
  }

  async deleteMemory(id: string): Promise<boolean> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return false;
    }

    try {
      await this.table.delete(`id = '${id}'`);
      logger.debug(`Deleted memory entry: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete memory:', error);
      return false;
    }
  }

  async updateMemory(id: string, content: string): Promise<boolean> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return false;
    }

    try {
      // Check if memory exists
      const results = await this.table.query().where(`id = '${id}'`).select(['id']).limit(1).toArray();

      if (results.length === 0) {
        logger.warn(`Memory not found for update: ${id}`);
        return false;
      }

      const vector = await this.getEmbedding(content);

      if (!vector) {
        logger.error('Failed to generate embedding for memory update');
        return false;
      }

      await this.table.update({
        where: `id = '${id}'`,
        values: {
          content,
          vector,
        },
      });

      logger.debug(`Updated memory entry: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to update memory:', error);
      return false;
    }
  }

  async getAllMemories(): Promise<MemoryEntry[]> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return [];
    }

    const results = await this.table.query().select(['id', 'content', 'type', 'timestamp', 'projectid', 'taskid']).toArray();

    // Map results back to MemoryEntry interface
    // Note: LanceDB returns rows, we cast them to our interface
    return results.map((result) => ({
      id: result.id as string,
      content: result.content as string,
      type: result.type as MemoryEntryType,
      timestamp: result.timestamp as number,
      projectId: result.projectid as string,
      taskId: result.taskid as string,
    }));
  }

  async deleteMemoriesForProject(projectId: string): Promise<number> {
    if (!(await this.waitForInit()) || !this.isMemoryEnabled() || !this.db || !this.table) {
      return 0;
    }

    try {
      const results = await this.table.query().where(`projectid = '${projectId}'`).select(['id']).toArray();
      const ids = results.map((r) => (r as { id: string }).id).filter(Boolean);
      await Promise.all(ids.map((id) => this.table!.delete(`id = '${id}'`)));
      logger.info('Deleted project memories', { projectId, count: ids.length });
      return ids.length;
    } catch (error) {
      logger.error('Failed to delete project memories:', error);
      return 0;
    }
  }

  async clearAllMemories(): Promise<boolean> {
    if (!this.isInitialized || !this.isMemoryEnabled() || !this.db) {
      return false;
    }

    try {
      await this.db.dropTable(this.tableName);
      this.table = null;
      logger.info('Cleared all memories');
      return true;
    } catch (error) {
      logger.error('Failed to clear memories:', error);
      return false;
    }
  }

  isMemoryEnabled(): boolean {
    return (this.isInitialized && this.store.getSettings().memory.enabled) || false;
  }
}
