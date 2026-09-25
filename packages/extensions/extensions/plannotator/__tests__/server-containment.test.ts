import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// startReviewServer persists nothing for the code-review route, but keep
// homedir sandboxed anyway so any incidental write lands in a throwaway
// directory.
const mockHome = vi.hoisted(() => ({ home: "" }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

import { createGatedServer, startReviewServer } from "../server";

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-containment-test-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

/** Send one raw HTTP request (Connection: close) and return the full response. */
const rawRequest = (port: number, raw: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    let body = "";
    socket.setEncoding("utf-8");
    socket.on("connect", () => socket.write(raw));
    socket.on("data", (chunk: string) => {
      body += chunk;
    });
    socket.on("close", () => resolve(body));
    socket.on("error", reject);
    // Safety net so a wedged connection fails the test instead of hanging it.
    setTimeout(() => reject(new Error("raw request timed out")), 5000);
  });

const tokenOf = (url: string): string =>
  url.match(/#token=([0-9a-f]+)$/)?.[1] ?? "";

describe("review server request containment", () => {
  it("answers 400 for malformed request targets instead of crashing with an unhandled URL error", async () => {
    const server = startReviewServer({
      rawPatch: "diff",
      gitRef: "test",
      htmlContent: "<html><body>x</body></html>",
    });
    const { port } = server;
    const token = tokenOf(server.url);

    try {
      // Each of these targets passes the node:http request parser (the
      // request itself is delivered to the handler) but REJECTS inside
      // `new URL(req.url)`. Previously that rejection escaped the async
      // handler as an unhandled rejection and killed the main process; it
      // must degrade to a 400 response instead.
      const malformedTargets = ["http://", "http://[", "http://:80", "//%"];
      for (const target of malformedTargets) {
        const response = await rawRequest(
          port,
          `GET ${target} HTTP/1.1\r\nHost: h\r\n` +
            `x-plannotator-token: ${token}\r\nConnection: close\r\n\r\n`,
        );
        expect(response).toContain(" 400 ");
      }

      // The server must still be alive and serving well-formed requests.
      const healthy = await rawRequest(
        port,
        `GET /api/diff HTTP/1.1\r\nHost: h\r\n` +
          `x-plannotator-token: ${token}\r\nConnection: close\r\n\r\n`,
      );
      expect(healthy).toContain(" 200 ");
      expect(healthy).toContain('"rawPatch":"diff"');
    } finally {
      server.stop();
    }
  });

  it("contains exceptions thrown inside async handlers as 500 responses", async () => {
    // A handler that blows up (synchronous throw inside the async function
    // and a rejected promise) must not escape as an unhandled rejection —
    // the containment turns it into a 500.
    const server = createGatedServer("tok", async (req, res, url) => {
      if (url.pathname === "/throw-sync") {
        throw new Error("boom");
      }
      if (url.pathname === "/reject") {
        await Promise.reject(new Error("boom-async"));
        return;
      }
      res.end("ok");
    });
    server.listen(0);
    const port = (server.address() as { port: number }).port;

    try {
      for (const path of ["/throw-sync", "/reject"]) {
        const response = await rawRequest(
          port,
          `GET ${path} HTTP/1.1\r\nHost: h\r\n` +
            `x-plannotator-token: tok\r\nConnection: close\r\n\r\n`,
        );
        expect(response).toContain(" 500 ");
        expect(response).toContain("Internal server error");
      }
    } finally {
      server.close();
    }
  });
});
