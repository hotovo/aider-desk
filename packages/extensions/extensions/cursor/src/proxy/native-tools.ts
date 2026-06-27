import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path'

import { create } from '@bufbuild/protobuf'

import type { ExecServerMessage, McpToolDefinition } from '../proto/agent_pb'
import {
  DeleteErrorSchema,
  DeleteResultSchema,
  DeleteSuccessSchema,
  FetchErrorSchema,
  FetchResultSchema,
  FetchSuccessSchema,
  GrepContentMatchSchema,
  GrepContentResultSchema,
  GrepErrorSchema,
  GrepFileMatchSchema,
  GrepResultSchema,
  GrepSuccessSchema,
  GrepUnionResultSchema,
  LsDirectoryTreeNodeSchema,
  LsDirectoryTreeNode_FileSchema,
  LsErrorSchema,
  LsResultSchema,
  LsSuccessSchema,
  ReadErrorSchema,
  ReadResultSchema,
  ReadSuccessSchema,
  ShellResultSchema,
  ShellSuccessSchema,
  WriteErrorSchema,
  WriteResultSchema,
  WriteSuccessSchema,
} from '../proto/agent_pb'

/** Prefix Cursor uses for MCP tool names (e.g. `mcp_aiderdesk_read`). */
export const MCP_TOOL_PREFIX = 'mcp_aiderdesk_'

/** Removes the `mcp_aiderdesk_` prefix from a tool name, if present. */
export function stripMcpToolPrefix(name: string): string {
  return name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name
}

/** Builds the enabled Pi tool set from Cursor MCP tool registrations. */
export function buildEnabledToolSet(mcpTools: McpToolDefinition[]): Set<string> {
  const enabledToolNames = new Set<string>()

  for (const tool of mcpTools) {
    const toolName = stripMcpToolPrefix(tool.toolName)
    if (toolName) {
      enabledToolNames.add(toolName)
    }
  }

  return enabledToolNames
}

/** Fixes argument name mismatches — Cursor sometimes sends `filePath` instead of `path`. */
export function fixMcpArgNames(toolName: string, args: Record<string, unknown>): void {
  // Cursor sometimes sends 'filePath' instead of 'path' for tools that expect 'path'
  if (['read', 'write', 'edit', 'grep', 'find', 'ls'].includes(toolName) && args.filePath && !args.path) {
    args.path = args.filePath
    delete args.filePath
  }
}

/**
 * Exec cases that map to Pi tools via native redirection.
 * Shared between classifyExecMessage and nativeToMcpRedirect to prevent list drift.
 */
export const REDIRECTABLE_EXEC_CASES = new Set([
  'readArgs',
  'writeArgs',
  'deleteArgs',
  'shellArgs',
  'shellStreamArgs',
  'lsArgs',
  'grepArgs',
  'fetchArgs',
])

export type ExecClassification = 'redirect' | 'passthrough' | 'internal' | 'reject'

/** Classifies a Cursor exec message type for routing: redirect to Pi, pass through, handle internally, or reject. */
export function classifyExecMessage(execCase: string): ExecClassification {
  if (REDIRECTABLE_EXEC_CASES.has(execCase)) {
    return 'redirect'
  }
  if (execCase === 'mcpArgs') {
    return 'passthrough'
  }
  if (execCase === 'requestContextArgs') {
    return 'internal'
  }
  return 'reject'
}

// ---------------------------------------------------------------------------
// Allowed Root & Path Sandboxing
// ---------------------------------------------------------------------------

/**
 * Finds the nearest git root containing `cwd` by walking up directories
 * looking for `.git`. Falls back to `cwd` itself if no git repo is found.
 */
export function resolveAllowedRoot(cwd: string): string {
  let dir = resolve(cwd)
  for (;;) {
    try {
      if (existsSync(resolve(dir, '.git'))) {
        return dir
      }
    } catch {
      // Permission denied or inaccessible — stop walking
      return resolve(cwd)
    }
    const parent = dirname(dir)
    if (parent === dir) {
      // Reached filesystem root — no git repo found
      return resolve(cwd)
    }
    dir = parent
  }
}

/**
 * Resolves a file path and verifies it falls within the allowed root.
 * Returns the resolved absolute path. Throws on path traversal violations.
 */
export function validatePath(filePath: string, allowedRoot: string): string {
  const resolved = isAbsolute(filePath) ? normalize(filePath) : resolve(allowedRoot, filePath)
  const normalizedRoot = normalize(allowedRoot)

  // Ensure the resolved path starts with the allowed root
  // Add separator to prevent /foo matching /foobar
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + sep)) {
    throw new Error(`Path '${filePath}' is outside the allowed root '${allowedRoot}'`)
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Proxy-local native tool execution
// ---------------------------------------------------------------------------

export interface NativeExecResult {
  resultType: string
  result: unknown
}

/**
 * Execute a Cursor native tool call locally within the allowed root.
 * Returns the protobuf result to send back to Cursor's server.
 */
export async function executeNativeLocally(execMsg: ExecServerMessage, allowedRoot: string): Promise<NativeExecResult> {
  const msg = execMsg.message

  if (msg.case === 'readArgs') {
    return executeRead(msg.value, allowedRoot)
  }
  if (msg.case === 'writeArgs') {
    return executeWrite(msg.value, allowedRoot)
  }
  if (msg.case === 'deleteArgs') {
    return executeDelete(msg.value, allowedRoot)
  }
  if (msg.case === 'shellArgs' || msg.case === 'shellStreamArgs') {
    return executeShell(msg.value, allowedRoot, msg.case === 'shellStreamArgs')
  }
  if (msg.case === 'lsArgs') {
    return executeLs(msg.value, allowedRoot)
  }
  if (msg.case === 'grepArgs') {
    return executeGrep(msg.value, allowedRoot)
  }
  if (msg.case === 'fetchArgs') {
    return executeFetch(msg.value)
  }

  throw new Error(`Unsupported native exec case: ${msg.case}`)
}

async function executeRead(
  args: { path: string; offset?: number; limit?: number },
  allowedRoot: string,
): Promise<NativeExecResult> {
  try {
    const resolvedPath = validatePath(args.path, allowedRoot)
    const content = await readFile(resolvedPath, 'utf-8')
    const lines = content.split('\n')
    const totalLines = lines.length
    const fileSize = Buffer.byteLength(content)

    let outputLines = lines
    let truncated = false
    if (args.offset !== undefined || args.limit !== undefined) {
      const start = (args.offset ?? 1) - 1 // 1-indexed
      const end = args.limit ? start + args.limit : undefined
      outputLines = lines.slice(Math.max(0, start), end)
      truncated = end !== undefined && end < totalLines
    }

    return {
      resultType: 'readResult',
      result: create(ReadResultSchema, {
        result: {
          case: 'success',
          value: create(ReadSuccessSchema, {
            path: args.path,
            totalLines,
            fileSize: BigInt(fileSize),
            truncated,
            output: { case: 'content', value: outputLines.join('\n') },
          }),
        },
      }),
    }
  } catch (error) {
    return {
      resultType: 'readResult',
      result: create(ReadResultSchema, {
        result: {
          case: 'error',
          value: create(ReadErrorSchema, {
            path: args.path,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }
}

async function executeWrite(
  args: { path: string; fileText: string; fileBytes: Uint8Array; toolCallId: string },
  allowedRoot: string,
): Promise<NativeExecResult> {
  try {
    const resolvedPath = validatePath(args.path, allowedRoot)
    const content = args.fileBytes.length > 0 ? new TextDecoder().decode(args.fileBytes) : args.fileText
    // Ensure parent directory exists
    await mkdir(dirname(resolvedPath), { recursive: true })
    await writeFile(resolvedPath, content, 'utf-8')
    const lineCount = content.split('\n').length
    return {
      resultType: 'writeResult',
      result: create(WriteResultSchema, {
        result: {
          case: 'success',
          value: create(WriteSuccessSchema, {
            path: args.path,
            linesCreated: lineCount,
          }),
        },
      }),
    }
  } catch (error) {
    return {
      resultType: 'writeResult',
      result: create(WriteResultSchema, {
        result: {
          case: 'error',
          value: create(WriteErrorSchema, {
            path: args.path,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }
}

async function executeDelete(
  args: { path: string; toolCallId: string },
  allowedRoot: string,
): Promise<NativeExecResult> {
  if (!args.path) {
    // Empty path — no-op
    return {
      resultType: 'deleteResult',
      result: create(DeleteResultSchema, {
        result: {
          case: 'success',
          value: create(DeleteSuccessSchema, { path: '' }),
        },
      }),
    }
  }

  // Validate path BEFORE try/catch so traversal errors are not swallowed
  let resolvedPath: string
  try {
    resolvedPath = validatePath(args.path, allowedRoot)
  } catch (error) {
    return {
      resultType: 'deleteResult',
      result: create(DeleteResultSchema, {
        result: {
          case: 'error',
          value: create(DeleteErrorSchema, {
            path: args.path,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }

  try {
    await unlink(resolvedPath)
    return {
      resultType: 'deleteResult',
      result: create(DeleteResultSchema, {
        result: {
          case: 'success',
          value: create(DeleteSuccessSchema, { path: args.path }),
        },
      }),
    }
  } catch {
    // Delete is best-effort — file not found is not an error
    return {
      resultType: 'deleteResult',
      result: create(DeleteResultSchema, {
        result: {
          case: 'success',
          value: create(DeleteSuccessSchema, { path: args.path }),
        },
      }),
    }
  }
}

/** Max shell execution time (60 seconds) */
const SHELL_TIMEOUT_MS = 60_000

/** Max combined stdout+stderr output (2 MB) */
const SHELL_MAX_OUTPUT_BYTES = 2 * 1024 * 1024

/** Environment variable prefixes to strip from child processes */
const SENSITIVE_ENV_PREFIXES = ['AIDERDESK_', 'CURSOR_', 'AWS_', 'GITHUB_TOKEN', 'GH_TOKEN', 'OPENAI_API', 'ANTHROPIC_API']

/** Build a sanitized copy of process.env with sensitive variables removed */
function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (SENSITIVE_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete env[key]
    }
  }
  return env
}

function executeShell(
  args: { command: string; workingDirectory?: string; toolCallId: string },
  allowedRoot: string,
  isStream: boolean,
): Promise<NativeExecResult> {
  const resultType = isStream ? 'shellStreamResult' : 'shellResult'
  const cwd = args.workingDirectory ? validatePath(args.workingDirectory, allowedRoot) : allowedRoot

  return new Promise((resolvePromise) => {
    const startTime = Date.now()
    let settled = false
    let totalOutputBytes = 0
    let outputCapped = false

    const child = spawn(args.command, {
      shell: true,
      cwd,
      env: sanitizedEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Timeout: kill child after SHELL_TIMEOUT_MS
    const timeout = setTimeout(() => {
      if (!settled) {
        child.kill('SIGKILL')
      }
    }, SHELL_TIMEOUT_MS)

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    function capOutput(chunk: Buffer, chunks: Buffer[]): void {
      totalOutputBytes += chunk.length
      if (totalOutputBytes > SHELL_MAX_OUTPUT_BYTES) {
        outputCapped = true
        const excess = totalOutputBytes - SHELL_MAX_OUTPUT_BYTES
        chunks.push(chunk.subarray(0, chunk.length - excess))
        // Kill the process to stop wasting CPU
        child.kill('SIGKILL')
      } else {
        chunks.push(chunk)
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      if (outputCapped) {
        return
      }
      capOutput(chunk, stdoutChunks)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (outputCapped) {
        return
      }
      capOutput(chunk, stderrChunks)
    })

    child.on('close', (code, signal) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      const elapsed = Date.now() - startTime
      let stdout = Buffer.concat(stdoutChunks).toString('utf-8')
      let stderr = Buffer.concat(stderrChunks).toString('utf-8')

      if (outputCapped) {
        stdout += '\n[output truncated — exceeded 2 MB limit]'
      }
      if (signal === 'SIGKILL' && elapsed >= SHELL_TIMEOUT_MS - 100) {
        stderr += `\n[process killed — exceeded ${SHELL_TIMEOUT_MS / 1000}s timeout]`
      }

      resolvePromise({
        resultType,
        result: create(ShellResultSchema, {
          result: {
            case: 'success',
            value: create(ShellSuccessSchema, {
              command: args.command,
              workingDirectory: cwd,
              exitCode: code ?? 1,
              signal: signal ?? '',
              stdout,
              stderr,
              executionTime: elapsed,
            }),
          },
        }),
      })
    })

    child.on('error', (err) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      resolvePromise({
        resultType,
        result: create(ShellResultSchema, {
          result: {
            case: 'success',
            value: create(ShellSuccessSchema, {
              command: args.command,
              workingDirectory: cwd,
              exitCode: 1,
              stdout: '',
              stderr: err.message,
              executionTime: Date.now() - startTime,
            }),
          },
        }),
      })
    })
  })
}

async function executeLs(args: { path: string }, allowedRoot: string): Promise<NativeExecResult> {
  try {
    const resolvedPath = validatePath(args.path || '.', allowedRoot)
    const entries = await readdir(resolvedPath, { withFileTypes: true })
    const dirs: ReturnType<typeof create<typeof LsDirectoryTreeNodeSchema>>[] = []
    const files: ReturnType<typeof create<typeof LsDirectoryTreeNode_FileSchema>>[] = []

    for (const entry of entries) {
      const absPath = resolve(resolvedPath, entry.name)
      if (entry.isDirectory()) {
        dirs.push(create(LsDirectoryTreeNodeSchema, { absPath }))
      } else {
        files.push(create(LsDirectoryTreeNode_FileSchema, { name: entry.name }))
      }
    }

    return {
      resultType: 'lsResult',
      result: create(LsResultSchema, {
        result: {
          case: 'success',
          value: create(LsSuccessSchema, {
            directoryTreeRoot: create(LsDirectoryTreeNodeSchema, {
              absPath: resolvedPath,
              childrenDirs: dirs,
              childrenFiles: files,
            }),
          }),
        },
      }),
    }
  } catch (error) {
    return {
      resultType: 'lsResult',
      result: create(LsResultSchema, {
        result: {
          case: 'error',
          value: create(LsErrorSchema, {
            path: args.path,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }
}

async function executeGrep(args: { pattern: string; path?: string }, allowedRoot: string): Promise<NativeExecResult> {
  try {
    const searchPath = args.path ?? '.'
    const resolvedPath = validatePath(searchPath, allowedRoot)

    const output = await new Promise<string>((resolvePromise, reject) => {
      const child = spawn('grep', ['-rn', '--', args.pattern, resolvedPath], {
        cwd: allowedRoot,
        env: sanitizedEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      // Timeout: kill grep after SHELL_TIMEOUT_MS
      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
      }, SHELL_TIMEOUT_MS)

      const chunks: Buffer[] = []
      let totalBytes = 0
      let capped = false

      child.stdout.on('data', (chunk: Buffer) => {
        if (capped) {
          return
        }
        totalBytes += chunk.length
        if (totalBytes > SHELL_MAX_OUTPUT_BYTES) {
          capped = true
          const excess = totalBytes - SHELL_MAX_OUTPUT_BYTES
          chunks.push(chunk.subarray(0, chunk.length - excess))
          child.kill('SIGKILL')
        } else {
          chunks.push(chunk)
        }
      })

      child.on('close', (code) => {
        clearTimeout(timeout)
        // grep returns 1 for no matches (not an error)
        if (code === 0 || code === 1 || capped) {
          let result = Buffer.concat(chunks).toString('utf-8')
          if (capped) {
            result += '\n[grep output truncated — exceeded 2 MB limit]'
          }
          resolvePromise(result)
        } else {
          reject(new Error(`grep exited with code ${code}`))
        }
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    // Parse grep -rn output into GrepFileMatch structure
    const fileMatchMap = new Map<string, ReturnType<typeof create<typeof GrepContentMatchSchema>>[]>()
    for (const line of output.split('\n')) {
      if (!line) {
        continue
      }
      // Format: file:line:content
      const firstColon = line.indexOf(':')
      if (firstColon === -1) {
        continue
      }
      const secondColon = line.indexOf(':', firstColon + 1)
      if (secondColon === -1) {
        continue
      }
      const file = line.slice(0, firstColon)
      const lineNum = Number.parseInt(line.slice(firstColon + 1, secondColon), 10)
      const content = line.slice(secondColon + 1)
      if (!Number.isFinite(lineNum)) {
        continue
      }

      let matches = fileMatchMap.get(file)
      if (!matches) {
        matches = []
        fileMatchMap.set(file, matches)
      }
      matches.push(create(GrepContentMatchSchema, { lineNumber: lineNum, content }))
    }

    const fileMatches = [...fileMatchMap.entries()].map(([file, matches]) =>
      create(GrepFileMatchSchema, { file, matches }),
    )

    return {
      resultType: 'grepResult',
      result: create(GrepResultSchema, {
        result: {
          case: 'success',
          value: create(GrepSuccessSchema, {
            pattern: args.pattern,
            path: searchPath,
            outputMode: 'content',
            workspaceResults: {
              default: create(GrepUnionResultSchema, {
                result: {
                  case: 'content',
                  value: create(GrepContentResultSchema, { matches: fileMatches }),
                },
              }),
            },
          }),
        },
      }),
    }
  } catch (error) {
    return {
      resultType: 'grepResult',
      result: create(GrepResultSchema, {
        result: {
          case: 'error',
          value: create(GrepErrorSchema, {
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }
}

/** Max fetch response size (10 MB) */
const FETCH_MAX_RESPONSE_BYTES = 10 * 1024 * 1024

/** Fetch timeout (30 seconds) */
const FETCH_TIMEOUT_MS = 30_000

/** Block fetches to private/internal networks and non-HTTP schemes */
function validateFetchUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme '${parsed.protocol}' — only http/https allowed`)
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
    throw new Error('Blocked fetch to localhost')
  }

  // Block IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1, ::ffff:10.0.0.1)
  if (hostname.startsWith('::ffff:')) {
    throw new Error('Blocked fetch to IPv6-mapped address')
  }

  // Block IPv6 link-local and unique local addresses
  if (hostname.startsWith('fe80:') || hostname.startsWith('fd') || hostname.startsWith('fc')) {
    throw new Error('Blocked fetch to IPv6 private address')
  }

  // Block link-local / metadata (169.254.x.x)
  if (hostname.startsWith('169.254.')) {
    throw new Error('Blocked fetch to link-local/metadata address')
  }

  // Block private RFC-1918 ranges and 0.x.x.x
  const parts = hostname.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number)
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      a === 0
    ) {
      throw new Error('Blocked fetch to private network address')
    }
  }
}

async function executeFetch(args: { url: string; toolCallId: string }): Promise<NativeExecResult> {
  try {
    validateFetchUrl(args.url)
    const response = await fetch(args.url, {
      redirect: 'manual', // Prevent redirect-based SSRF bypass
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    // Read response with size cap to prevent OOM
    const reader = response.body?.getReader()
    let content: string
    if (reader) {
      const chunks: Uint8Array[] = []
      let totalBytes = 0
      let truncated = false
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        totalBytes += value.length
        if (totalBytes > FETCH_MAX_RESPONSE_BYTES) {
          truncated = true
          chunks.push(value.subarray(0, value.length - (totalBytes - FETCH_MAX_RESPONSE_BYTES)))
          void reader.cancel()
          break
        }
        chunks.push(value)
      }
      const combined = Buffer.concat(chunks)
      content = combined.toString('utf-8')
      if (truncated) {
        content += '\n[response truncated — exceeded 10 MB limit]'
      }
    } else {
      content = await response.text()
    }
    return {
      resultType: 'fetchResult',
      result: create(FetchResultSchema, {
        result: {
          case: 'success',
          value: create(FetchSuccessSchema, {
            url: args.url,
            content,
            statusCode: response.status,
            contentType: response.headers.get('content-type') ?? '',
          }),
        },
      }),
    }
  } catch (error) {
    return {
      resultType: 'fetchResult',
      result: create(FetchResultSchema, {
        result: {
          case: 'error',
          value: create(FetchErrorSchema, {
            url: args.url,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      }),
    }
  }
}
