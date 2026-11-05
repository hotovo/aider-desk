import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { connect, createConnection } from "node:net";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startPlanReviewServer } from "../server";

// startPlanReviewServer persists the plan into ~/.plannotator/history via
// os.homedir(). Point homedir at a throwaway directory so tests never touch
// the developer's real HOME, and remove it after the suite.
const mockHome = vi.hoisted(() => ({ home: "" }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-body-test-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

interface PlanServer {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ approved: boolean; feedback?: string }>;
  stop: () => void;
}

const waitFor = async (ms: number): Promise<void> =>
  new Promise((resolveAwait) => setTimeout(resolveAwait, ms));

/** Base URL without the out-of-band #token fragment (for hitting API paths). */
const baseUrlOf = (url: string): string => url.split("#")[0];
const tokenOf = (url: string): string =>
  url.match(/#token=([0-9a-f]+)$/)?.[1] ?? "";

const startServer = (): PlanServer =>
  startPlanReviewServer({
    plan: "# Plan",
    htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
  }) as PlanServer;

const post = (
  baseUrl: string,
  token: string,
  path: string,
  body: string,
): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-plannotator-token": token },
    body,
  });

describe("plan review server request body limits", () => {
  it("accepts a normal JSON body and resolves the decision", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const decision = server.waitForDecision();
      const res = await post(
        baseUrl,
        tokenOf(server.url),
        "/api/approve",
        JSON.stringify({ feedback: "ok", reviewId: "ignored-by-server" }),
      );
      expect(res.status).toBe(200);
      await expect(decision).resolves.toEqual({ approved: true, feedback: "ok" });
    } finally {
      server.stop();
    }
  });

  it("enforces the body cap by UTF-8 byte length, not JS character length", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const decision = server.waitForDecision();
      let settled = false;
      void decision.then(() => {
        settled = true;
      });

      // 40960 two-byte 'é' characters = 81920 UTF-8 bytes — over the 64 KiB
      // byte budget while well under it in JS characters. The cap must trip.
      const res = await post(
        baseUrl,
        tokenOf(server.url),
        "/api/approve",
        JSON.stringify({ feedback: "é".repeat(40960) }),
      );
      expect(res.status).toBe(413);

      await waitFor(100);
      expect(settled).toBe(false);
    } finally {
      server.stop();
    }
  });

  it("rejects an oversized body with 413 and does not resolve the decision", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const decision = server.waitForDecision();
      let settled = false;
      void decision.then(() => {
        settled = true;
      });

      // 64 KiB cap: a 128 KiB feedback payload is discarded, the endpoint
      // rejects with 413 and the pending review stays unresolved.
      const res = await post(
        baseUrl,
        tokenOf(server.url),
        "/api/approve",
        JSON.stringify({ feedback: "x".repeat(128 * 1024) }),
      );
      expect(res.status).toBe(413);

      await waitFor(100);
      expect(settled).toBe(false);
    } finally {
      server.stop();
    }
  });

  it("preserves multi-byte characters split across chunk boundaries", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const token = tokenOf(server.url);
      const decision = server.waitForDecision();

      // Raw socket with chunked framing so the middle of a multi-byte
      // character lands exactly on a chunk boundary. Previously parseBody
      // decoded each chunk independently (`data += chunk.toString()`), so a
      // split 'é' (0xC3 0xA9) became U+FFFD + '©' garbage instead of 'é'.
      const target = new URL(baseUrl);
      const socket = connect(target.port, target.hostname);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      const first = Buffer.concat([
        Buffer.from('{"feedback":"h', "utf8"),
        Buffer.from([0xc3]),
      ]);
      const second = Buffer.from([0xa9, 0x3f, 0x22, 0x7d]); // 'é' tail + '?', '"', '}'
      socket.write(
        `POST /api/approve HTTP/1.1\r\nHost: ${target.host}\r\n` +
          `x-plannotator-token: ${token}\r\ncontent-type: application/json\r\n` +
          `Transfer-Encoding: chunked\r\n\r\n`,
      );
      socket.write(`${first.length.toString(16)}\r\n`);
      socket.write(first);
      socket.write("\r\n");
      socket.write(`${second.length.toString(16)}\r\n`);
      socket.write(second);
      socket.write("\r\n0\r\n\r\n");

      // The reassembled body is exactly {"feedback":"hé?": 'é' preserved
      // across the boundary and '©' (0xA9) NOT leaking through.
      await expect(decision).resolves.toEqual({
        approved: true,
        feedback: "hé?",
      });
    } finally {
      server.stop();
    }
  });

  it("resolves the decision with default feedback on a malformed JSON body", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const decision = server.waitForDecision();
      const res = await post(baseUrl, tokenOf(server.url), "/api/deny", "{not json");
      expect(res.status).toBe(200);
      await expect(decision).resolves.toEqual({
        approved: false,
        feedback: "Plan rejected",
      });
    } finally {
      server.stop();
    }
  });

  it("does NOT resolve the decision when the client aborts mid-body", async () => {
    const server = startServer();
    try {
      const baseUrl = baseUrlOf(server.url);
      const token = tokenOf(server.url);
      const decision = server.waitForDecision();

      // Raw socket so we control the cutoff: send valid request headers with
      // an (empty-body) Content-Length 0, then destroy the socket before the
      // server can settle anything...
      const target = new URL(baseUrl);
      const socket = connect(target.port, target.hostname);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      socket.write(
        `POST /api/approve HTTP/1.1\r\nHost: ${target.host}\r\n` +
          `x-plannotator-token: ${token}\r\ncontent-type: application/json\r\n` +
          `Content-Length: 100000\r\n\r\n{"feedback":"partial`,
      );
      await waitFor(50);
      socket.destroy();
      socket.once("error", () => {
        /* Windows ECONNRESET races */
      });

      const checkResponse = await fetch(`${baseUrl}/api/plan`, {
        headers: { "x-plannotator-token": token },
      });
      // The server itself is still healthy (the abort must not have taken it
      // down with an unhandled rejection).
      expect(checkResponse.status).toBe(200);
      await checkResponse.text();

      // The abort settles parseBody as INTERRUPTED: no valid payload was
      // delivered, so the endpoint must NOT derive an approval from the empty
      // body — the decision stays unresolved (a hung request previously
      // resolved as approved out of thin air; both behaviors pin the tool
      // call, but only "unresolved" reflects that no decision ever arrived).
      await waitFor(200);
      let settled = false;
      void decision.then(() => {
        settled = true;
      });
      await waitFor(150);
      expect(settled).toBe(false);
    } finally {
      server.stop();
    }
  });

  it("destroys the connection after answering an oversized request with 413", async () => {
    const server = startPlanReviewServer({
      plan: "# Body limit socket test",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;
    const baseUrl = baseUrlOf(server.url);
    const token = tokenOf(server.url);
    const target = new URL(baseUrl);

    try {
      const result = await new Promise<boolean>((resolveClose, rejectClose) => {
        let saw413 = false;
        const socket = createConnection(parseInt(new URL(baseUrl).port, 10), "127.0.0.1");
        const failTimer = setTimeout(() => {
          rejectClose(new Error(saw413 ? "socket was not destroyed after 413" : "no 413 response"));
        }, 5000);
        socket.setTimeout(0);
        socket.on("connect", () => {
          socket.write(
            "POST /api/approve HTTP/1.1\r\n" +
              "Host: localhost\r\n" +
              `x-plannotator-token: ${token}\r\n` +
              "content-type: application/json\r\n" +
              "content-length: 240000\r\n\r\n",
          );
          // Stream a body well past the 64 KiB cap; the server answers 413
          // mid-stream and (post-hardening) tears the socket down instead of
          // letting the oversized request keep its connection open.
          const chunk = Buffer.alloc(8192, 0x78);
          for (let i = 0; i < 30; i++) {
            socket.write(chunk);
          }
        });
        let buffer = "";
        socket.on("data", (data) => {
          buffer += data.toString();
          if (!saw413 && buffer.includes("HTTP/1.1 413")) {
            saw413 = true;
          }
        });
        socket.on("close", () => {
          clearTimeout(failTimer);
          resolveClose(saw413);
        });
        socket.on("error", () => {
          if (!saw413) {
            clearTimeout(failTimer);
          }
        });
      });
      expect(result).toBe(true);
    } finally {
      server.stop();
    }
  });
});
