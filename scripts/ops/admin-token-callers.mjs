// Gate for the ADMIN_ACCESS_TOKEN rotation and the PR #33 release: the GX10 and Hermes callers must be
// confirmed by someone who checked those machines. 8940 cannot read GX10, so this is never inferred:
// without a complete record, rotation `apply` refuses and the release preflight FAILs (blocking).
// Record (not in Git): %USERPROFILE%\.fuyun-tools\release\admin-token-callers.json
//   { "gx10":   { "checked": true, "checkedBy": "...", "checkedAt": "2026-..Z", "method": "grep of ... / crontab / hermes config",
//                 "usesAdminAccessToken": false, "usesQueryParam": false, "readyForNewValue": true },
//     "hermes": { ...same fields } }
// A caller that uses the token must send it in a header (usesQueryParam false) and be ready to take the
// new value in the same release window (readyForNewValue true).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const CALLERS_FILE = path.join(process.env.USERPROFILE || "", ".fuyun-tools", "release", "admin-token-callers.json");
export const REQUIRED_CALLERS = ["gx10", "hermes"];

export function checkCallers(record) {
  const problems = [];
  if (!record || typeof record !== "object") return { ok: false, problems: ["no caller confirmation record"] };
  for (const name of REQUIRED_CALLERS) {
    const c = record[name];
    if (!c) { problems.push(`${name}: not confirmed`); continue; }
    if (c.checked !== true) problems.push(`${name}: checked is not true`);
    if (!c.checkedBy || !String(c.checkedBy).trim()) problems.push(`${name}: checkedBy missing`);
    if (!c.method || !String(c.method).trim()) problems.push(`${name}: method missing`);
    if (Number.isNaN(Date.parse(c.checkedAt || ""))) problems.push(`${name}: checkedAt missing or not a date`);
    if (typeof c.usesAdminAccessToken !== "boolean") problems.push(`${name}: usesAdminAccessToken must be true or false`);
    if (c.usesQueryParam !== false) problems.push(`${name}: must not send the token in ?admin_token= (usesQueryParam must be false)`);
    if (c.usesAdminAccessToken === true && c.readyForNewValue !== true) problems.push(`${name}: uses the token but is not ready for the new value`);
  }
  return { ok: problems.length === 0, problems };
}

export function readCallers(file = CALLERS_FILE) {
  if (!existsSync(file)) return { ok: false, problems: [`no caller confirmation record (${file})`] };
  try {
    return checkCallers(JSON.parse(readFileSync(file, "utf8")));
  } catch (x) {
    return { ok: false, problems: [`caller record unreadable: ${x.message}`] };
  }
}
