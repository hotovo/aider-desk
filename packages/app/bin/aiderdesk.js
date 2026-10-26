#!/usr/bin/env node

const path = require("path");

const pkgRoot = path.resolve(__dirname, "..");

const [major, minor, patch] = process.versions.node.split(".").map(Number);
const patchedVersions = {
  22: [23, 4],
  24: [22, 1],
  26: [12, 1],
};
const minimum = patchedVersions[major];
const isUnpatched = minimum
  ? minor < minimum[0] || (minor === minimum[0] && patch < minimum[1])
  : major < 27;

if (isUnpatched) {
  console.warn(
    `[AiderDesk security warning] Node.js ${process.versions.node} predates the eMudhra certificate-compromise fixes. ` +
      "HTTPS connections may trust compromised certificates. Upgrade to Node.js 22.23.4+, 24.22.1+, or 26.12.1+ within the respective major version. " +
      "AiderDesk will continue running.",
  );
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

require(path.join(pkgRoot, "out", "cli.js"));
