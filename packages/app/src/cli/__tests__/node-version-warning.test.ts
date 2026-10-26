import { readFileSync } from "fs";
import { resolve } from "path";
import { runInNewContext } from "vm";

import { describe, expect, it, vi } from "vitest";

const launcherPath = resolve(import.meta.dirname, "../../../bin/aiderdesk.js");
const launcherSource = readFileSync(launcherPath, "utf8");

const runLauncher = (version: string) => {
  const warn = vi.fn();
  const loadCli = vi.fn();
  const env: Record<string, string> = {};
  const requireModule = (name: string) => {
    if (name === "path") {
      return { resolve, join: (...parts: string[]) => parts.join("/") };
    }
    loadCli(name);
    return {};
  };

  runInNewContext(launcherSource, {
    require: requireModule,
    __dirname: resolve(import.meta.dirname, "../../../bin"),
    process: { versions: { node: version }, env },
    console: { warn },
  });

  return { warn, loadCli, env };
};

describe("npm app Node.js security warning", () => {
  it.each([
    "20.19.0",
    "21.7.0",
    "22.23.3",
    "23.11.0",
    "24.12.0",
    "24.22.0",
    "25.9.0",
    "26.12.0",
  ])("warns on Node.js %s without blocking CLI startup", (version) => {
    const { warn, loadCli, env } = runLauncher(version);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`Node.js ${version}`),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AiderDesk will continue running."),
    );
    expect(loadCli).toHaveBeenCalledWith(
      expect.stringContaining("/out/cli.js"),
    );
    expect(env.NODE_ENV).toBe("production");
  });

  it.each([
    "22.23.4",
    "22.24.0",
    "24.22.1",
    "24.23.0",
    "26.12.1",
    "26.13.0",
    "27.0.0",
  ])("does not warn on patched or subsequent Node.js %s", (version) => {
    const { warn, loadCli } = runLauncher(version);

    expect(warn).not.toHaveBeenCalled();
    expect(loadCli).toHaveBeenCalledOnce();
  });
});
