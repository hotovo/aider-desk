import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB

/** Reads the full request body as a string, rejecting if it exceeds 10 MB. */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

export function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Send an OpenAI-shaped error JSON response. */
export function errorResponse(res: ServerResponse, status: number, message: string, code = 'server_error'): void {
  jsonResponse(res, status, { error: { message, type: 'server_error', code } })
}
