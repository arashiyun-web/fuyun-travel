// Preload for the Vercel CLI on hosts whose Windows computer name is not ASCII (8940: 雲阿民).
// Vercel CLI 60.x builds its OAuth User-Agent from os.hostname(); a non-ASCII value makes fetch throw
// "Cannot convert argument to a ByteString" on token refresh. Loaded through NODE_OPTIONS by
// scripts/tools/vercel-ascii.ps1. It only acts inside the Vercel CLI process itself (argv[1] is
// .../vercel/dist/vc.js) and only when the real hostname is non-ASCII; every other Node process that
// inherits NODE_OPTIONS is left untouched. Nothing on the machine is changed.
const os = require("node:os");
const { createHash } = require("node:crypto");

function asciiHostname(name) {
  if (/^[\x21-\x7E]+$/.test(name)) return name;
  return `host-${createHash("sha256").update(name).digest("hex").slice(0, 8)}`;
}

function isVercelCli(entry) {
  return /[\\/]vercel[\\/]dist[\\/]vc\.js$/i.test(entry || "");
}

if (isVercelCli(process.argv[1])) {
  const original = os.hostname();
  const safe = asciiHostname(original);
  if (safe !== original) {
    os.hostname = () => safe;
    require("node:module").syncBuiltinESMExports();
  }
}

module.exports = { asciiHostname, isVercelCli };
