import { describe, expect, it } from "vitest";

import { startReviewServer } from "../server";

const baseUrlOf = (url: string): string => url.split("#")[0];
const tokenOf = (url: string): string => url.match(/#token=([0-9a-f]+)$/)?.[1] ?? "";

const request = (serverUrl: string, body: unknown): Promise<Response> =>
  fetch(`${baseUrlOf(serverUrl)}/api/diff/switch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-plannotator-token": tokenOf(serverUrl),
    },
    body: JSON.stringify(body),
  });

describe("review server diff switch validation", () => {
  it("rejects unsupported diff types without changing the current diff", async () => {
    const server = startReviewServer({
      rawPatch: "initial patch",
      gitRef: "Uncommitted changes",
      diffType: "uncommitted",
      htmlContent: "<html></html>",
    });

    try {
      const invalid = await request(server.url, { diffType: "arbitrary" });
      expect(invalid.status).toBe(400);
      await expect(invalid.json()).resolves.toEqual({ error: "Unsupported diffType" });

      const current = await fetch(`${baseUrlOf(server.url)}/api/diff`, {
        headers: { "x-plannotator-token": tokenOf(server.url) },
      });
      expect(current.status).toBe(200);
      await expect(current.json()).resolves.toMatchObject({
        rawPatch: "initial patch",
        gitRef: "Uncommitted changes",
        diffType: "uncommitted",
      });
    } finally {
      server.stop();
    }
  });
});
