import { describe, expect, it } from "vitest";

import { buildServerUrl } from "../server";

describe("buildServerUrl", () => {
  it("defaults to localhost with the dynamic port when no host is configured", () => {
    expect(buildServerUrl(undefined, 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("", 41475)).toBe("http://localhost:41475");
  });

  it("appends the dynamic port to bare hostnames, IPv4, and IPv6 literals", () => {
    expect(buildServerUrl("localhost", 8080)).toBe("http://localhost:8080");
    // C1 control characters (U+0080-U+009F) are also invalid in a URL
    // authority and must fall back to localhost like ASCII controls (audit).
    expect(buildServerUrl("exa\u0080mple.com", 33221)).toBe(
      "http://localhost:33221",
    );
    // A backslash lets userinfo-style tail splicing redirect the authority
    // (`foo\\@evil.com` strips to evil.com) — reject and fall back (audit).
    expect(buildServerUrl("foo\\@evil.com", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("exa\u009Fmple.com", 33221)).toBe(
      "http://localhost:33221",
    );
    expect(buildServerUrl("aider.example.com", 33221)).toBe(
      "http://aider.example.com:33221",
    );
    expect(buildServerUrl("192.168.1.10", 33221)).toBe(
      "http://192.168.1.10:33221",
    );
    expect(buildServerUrl("::1", 33221)).toBe("http://[::1]:33221");
  });

  it("strips trailing slashes from bare hosts before appending the port", () => {
    expect(buildServerUrl("aider.example.com///", 8080)).toBe(
      "http://aider.example.com:8080",
    );
  });

  // Full origins are reverse-proxied endpoints on a fixed port (80/443):
  // appending the dynamic review port would make the review UI unreachable.
  it("keeps full origins without an explicit port verbatim (reverse-proxied endpoints)", () => {
    expect(buildServerUrl("https://plannotator.example.com", 41475)).toBe(
      "https://plannotator.example.com",
    );
    expect(buildServerUrl("http://plannotator.example.com", 8080)).toBe(
      "http://plannotator.example.com",
    );
    expect(buildServerUrl("https://plannotator.example.com/", 41475)).toBe(
      "https://plannotator.example.com",
    );
  });

  it("keeps full origins with an explicit port verbatim (already-resolved proxied endpoints)", () => {
    expect(buildServerUrl("https://plannotator.example.com:8443", 41475)).toBe(
      "https://plannotator.example.com:8443",
    );
    expect(buildServerUrl("http://plannotator.example.com:8080", 41475)).toBe(
      "http://plannotator.example.com:8080",
    );
    expect(buildServerUrl("http://[::1]:8443", 41475)).toBe(
      "http://[::1]:8443",
    );
  });

  it("trims surrounding whitespace from the configured host", () => {
    expect(buildServerUrl("  aider.example.com  ", 8080)).toBe(
      "http://aider.example.com:8080",
    );
  });

  it("falls back to the origin-only URL for path-prefixed hosts (no path-prefix routing)", () => {
    // The review servers are served at the origin root — paths configured on
    // the host are never part of the emitted review URL (documented fallback).
    expect(buildServerUrl("https://plannotator.example.com/base", 41475)).toBe(
      "https://plannotator.example.com",
    );
    expect(
      buildServerUrl("http://aider.example.com/app/sub?tab=1", 33221),
    ).toBe("http://aider.example.com");
    expect(buildServerUrl("example.com/app", 41475)).toBe(
      "http://example.com:41475",
    );
    expect(buildServerUrl("http://example.com/%2e%2e", 41475)).toBe(
      "http://example.com",
    );
  });

  it("treats bare host:port values as already-resolved endpoints, not IPv6", () => {
    expect(buildServerUrl("localhost:8080", 41475)).toBe(
      "http://localhost:8080",
    );
    expect(buildServerUrl("192.168.1.5:8080", 41475)).toBe(
      "http://192.168.1.5:8080",
    );
  });

  it("appends the dynamic port to bracketed IPv6 literals without a port", () => {
    expect(buildServerUrl("[::1]", 41475)).toBe("http://[::1]:41475");
  });

  it("brackets valid bare IPv6 literals including compressed and IPv4-mapped forms", () => {
    expect(buildServerUrl("2001:db8::1", 41475)).toBe(
      "http://[2001:db8::1]:41475",
    );
    expect(buildServerUrl("::ffff:192.168.0.1", 33221)).toBe(
      "http://[::ffff:192.168.0.1]:33221",
    );
    expect(
      buildServerUrl("1234:5678:90ab:cdef:1234:5678:90ab:cdef", 33221),
    ).toBe("http://[1234:5678:90ab:cdef:1234:5678:90ab:cdef]:33221");
    expect(buildServerUrl("http://2001:db8::1/prefix", 41475)).toBe(
      "http://[2001:db8::1]",
    );
  });

  it("falls back to localhost for malformed bare multi-colon hosts (not valid IPv6)", () => {
    expect(buildServerUrl("a::b::c", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("1:2:3:4:5:6:7:8:9", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("gg::1", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("1:2:3:4:5:6:7", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("::::1", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("http://a::b::c/path", 41475)).toBe(
      "http://localhost:41475",
    );
  });

  it("falls back to localhost for bare hosts carrying a non-numeric or out-of-range port", () => {
    expect(buildServerUrl("localhost:8080x", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("foo:bar", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("example.com:99999", 41475)).toBe(
      "http://localhost:41475",
    );
  });

  it("falls back origin-only for a bare host carrying a path", () => {
    expect(buildServerUrl("example.com/app", 41475)).toBe(
      "http://example.com:41475",
    );
  });

  it("strips userinfo credentials from the emitted URL (never echoed into logged/opened URLs)", () => {
    expect(
      buildServerUrl("https://user:pass@plannotator.example.com/base", 41475),
    ).toBe("https://plannotator.example.com");
    expect(
      buildServerUrl("https://user:pass@plannotator.example.com:8443", 41475),
    ).toBe("https://plannotator.example.com:8443");
    expect(buildServerUrl("user@plannotator.example.com", 41475)).toBe(
      "http://plannotator.example.com:41475",
    );
  });

  it("falls back to plain http localhost for an empty authority or unsupported/unsafe scheme", () => {
    // The review servers are plain HTTP — an https scheme must never be
    // paired with the localhost fallback (that would produce a dead https URL).
    expect(buildServerUrl("https://", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("https://user@", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("javascript:alert(1)", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("ftp://example.com", 41475)).toBe(
      "http://localhost:41475",
    );
  });

  it("falls back to localhost for malformed authorities", () => {
    expect(buildServerUrl("http://:8080", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("[::1", 41475)).toBe("http://localhost:41475");
  });

  it("falls back to localhost when the scheme/authority split cannot be parsed (never echoes a raw invalid value)", () => {
    // Defensive: if the uniform authority-extraction regex ever fails to run,
    // the raw (possibly malformed/scheme-like) input must not be returned as
    // the review URL — the default endpoint is emitted instead.
    expect(buildServerUrl("://evil.com", 41475)).toBe(
      "http://localhost:41475",
    );
  });

  it("falls back to localhost for malformed bracketed authorities", () => {
    // Empty brackets / non-IPv6 bracket content must never reach the emitted URL.
    expect(buildServerUrl("http://[]", 41475)).toBe("http://localhost:41475");
    expect(buildServerUrl("http://[a[b]]", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://[::1]junk", 41475)).toBe(
      "http://localhost:41475",
    );
    // Out-of-range explicit port on a bracketed authority is invalid.
    expect(buildServerUrl("http://[::1]:99999", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://[::1]:0", 41475)).toBe(
      "http://localhost:41475",
    );
  });

  it("keeps bracketed IPv6 authorities with an in-range explicit port verbatim (origin-only)", () => {
    expect(buildServerUrl("http://[::1]:65535/prefix", 41475)).toBe(
      "http://[::1]:65535",
    );
  });

  it("falls back to localhost for percent-encoded or whitespace-bearing authorities", () => {
    // Encoded hostnames can smuggle delimiters (`@`, `:`, `/`) past the
    // validation above once the URL is decoded by the consumer — they must
    // never be echoed into the emitted review URL.
    expect(buildServerUrl("%65xample.com", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://%65xample.com:8080", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://exa%20mple.com", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://example.com%3a8080", 41475)).toBe(
      "http://localhost:41475",
    );
    // Whitespace can never appear inside a real authority either.
    expect(buildServerUrl("http://exa mple.com", 41475)).toBe(
      "http://localhost:41475",
    );
    expect(buildServerUrl("http://example.com/%2e%2e", 41475)).toBe(
      "http://example.com",
    );
  });
});
