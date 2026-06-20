#!/usr/bin/env node

import http from 'node:http';
import net from 'node:net';
import { URL } from 'node:url';

const PORT = Number(process.env.PROXY_PORT) || 8888;

const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const timestamp = () => new Date().toISOString().split('T')[1].slice(0, 12);

/**
 * Simple HTTP forward proxy for testing AiderDesk's proxy settings.
 * Logs every HTTP request and HTTPS CONNECT that passes through.
 */
const server = http.createServer((req, res) => {
  if (!req.url?.startsWith('http://')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('This is a forward proxy. Use full URLs (http://host:port/path).');
    return;
  }

  const target = new URL(req.url);

  console.log(`[${timestamp()}] HTTP  ${BLUE}${req.method}${RESET}  ${target.host}${target.pathname}`);

  const proxyReq = http.request(
    {
      host: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`[${timestamp()}] ERROR ${err.message}`);
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
});

server.on('connect', (req, clientSocket, head) => {
  const [host, port] = req.url.split(':');

  console.log(`[${timestamp()}] ${BLUE}CONNECT${RESET} ${host}:${port || 443}`);

  const serverSocket = net.connect(port || 443, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error(`[${timestamp()}] ERROR ${err.message}`);
    clientSocket.end();
  });

  clientSocket.on('error', (err) => {
    console.error(`[${timestamp()}] ERROR ${err.message}`);
    serverSocket.end();
  });
});

server.listen(PORT, () => {
  console.log(`\n  Test proxy server running on http://127.0.0.1:${PORT}`);
  console.log(`  Set this as your proxy URL in AiderDesk settings.`);
  console.log(`  Watch this console to see which requests are proxied.\n`);
});
