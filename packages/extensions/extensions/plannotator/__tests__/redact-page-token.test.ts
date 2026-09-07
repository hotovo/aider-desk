import { describe, expect, it } from "vitest";

import { redactPageToken } from "../index";

describe("redactPageToken", () => {
  it("redacts the page-token fragment of a plain review URL", () => {
    expect(
      redactPageToken("Opening modal-overlay with http://localhost:41475/#token=abc123"),
    ).toBe("Opening modal-overlay with http://localhost:41475/#token=<redacted>");
  });

  it("redacts token fragments embedded inside a longer message", () => {
    // Error messages wrap URLs in quotes (e.g. execSync failures embed the
    // full command), so the fragment is NOT terminal — an end-anchored
    // pattern would miss it and leak the token into the logs.
    expect(
      redactPageToken(
        'Command failed: "browser" "http://localhost:41475/#token=SECRET" "title"',
      ),
    ).toContain("#token=<redacted>");
    expect(
      redactPageToken(
        'Command failed: "browser" "http://localhost:41475/#token=SECRET" "title"',
      ),
    ).not.toContain("SECRET");
  });

  it("redacts every occurrence in a message", () => {
    expect(
      redactPageToken(
        "open http://a/#token=one then http://b/#token=two failed",
      ),
    ).toBe(
      "open http://a/#token=<redacted> then http://b/#token=<redacted> failed",
    );
  });

  it("leaves URLs without a token fragment untouched", () => {
    expect(redactPageToken("http://localhost:41475/#anchor")).toBe(
      "http://localhost:41475/#anchor",
    );
    expect(redactPageToken("no url here")).toBe("no url here");
  });
});

describe("redaction helper responsibilities (shared behavior contract)", () => {
  // TWO redaction helpers protect the same plannotator review URL flow, with
  // explicitly divided responsibilities so they cannot silently overlap or
  // drift (audit: duplicated redaction logic):
  // 1. `redactPageToken` (this extension) — the OUT-OF-BAND page token that
  //    lives in the URL FRAGMENT (`#token=...`) and is pasted into error
  //    strings and chat logs by the extension host.
  // 2. `redactUrlToken` (src/main/utils/open-url.ts) — the same URL when it
  //    reaches MAIN-process navigation/logging, which additionally masks
  //    query-parameter tokens (`?token=...` / `&token=...`).

  it("extension helper: fragment tokens are fully masked", () => {
    expect(redactPageToken("http://localhost:41475/#token=abc123")).not.toContain("abc123");
    expect(redactPageToken("cmd failed: \"open\" \"http://localhost:41475/#token=abc123\"")).not.toContain("abc123");
  });

  it("extension helper: fragment value boundaries stop at delimiters (not URL-specific)", () => {
    const output = redactPageToken("page #token=abc&more");
    expect(output).toBe("page #token=<redacted>&more");
  });

  it("extension helper deliberately does NOT touch query params — the main helper owns that", () => {
    // Documented non-overlap: a ?token= query parameter in extension logs is
    // rewritten by the main-process openUrl helper, never here.
    expect(redactPageToken("http://x/?token=abc123")).toContain("abc123");
  });
});
