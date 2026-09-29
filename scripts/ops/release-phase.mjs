// Phase rules for release-preflight-pr33.mjs. The same preflight runs at two points of the runbook:
//   pre-release — runbook step 2, before the window: backup and Production env are not done yet (PENDING),
//                 production must still have only the 10 baseline migrations.
//   pre-deploy  — runbook step 6, after backup, migrations and env, before merge: nothing may be PENDING,
//                 production must have exactly the 13 migrations.
// Post-deploy acceptance (step 7) is not a preflight; it needs the new deployment and is done separately.
export const PHASES = ["pre-release", "pre-deploy"];
export const NEW_MIGRATIONS = ["202609280001_add_operations_tables", "202609280002_add_line_webhook_events", "202609290001_line_webhook_event_delivery"];
export const BASELINE_MIGRATIONS = 10;
export const BACKUP_MAX_AGE_H = 24;

export function parsePhase(argv) {
  const i = argv.indexOf("--phase");
  const phase = i > 0 ? argv[i + 1] : undefined;
  if (!PHASES.includes(phase)) throw new Error(`--phase is required: ${PHASES.join(" | ")} (runbook step 2 / step 6)`);
  return phase;
}

export function migrationChecks(phase, { done, unfinished, newer }) {
  const applied = (newer || "").split(",").filter(Boolean).sort();
  const detail = `finished=${done} unfinished=${unfinished}`;
  if (phase === "pre-release") {
    return [
      [Number(done) === BASELINE_MIGRATIONS && Number(unfinished) === 0 ? "PASS" : "FAIL", `production has the ${BASELINE_MIGRATIONS} baseline migrations, none unfinished`, detail],
      [applied.length === 0 ? "PASS" : "FAIL", "202609280001/0002 and 202609290001 not yet applied in production", applied.join(",") || "none"],
    ];
  }
  const total = BASELINE_MIGRATIONS + NEW_MIGRATIONS.length;
  const exact = applied.length === NEW_MIGRATIONS.length && applied.every((m, k) => m === [...NEW_MIGRATIONS].sort()[k]);
  return [
    [Number(done) === total && Number(unfinished) === 0 ? "PASS" : "FAIL", `production has all ${total} migrations finished, none unfinished`, detail],
    [exact ? "PASS" : "FAIL", "exactly 202609280001/0002 and 202609290001 applied after the baseline", applied.join(",") || "none"],
  ];
}

// backup: null, or { file, ageH, want, got } for the newest neon-prod-*.dump.
export function backupChecks(phase, backup) {
  if (phase === "pre-release") return [["PENDING", "production backup", "taken in the release window (runbook step 3)"]];
  if (!backup) return [["FAIL", "production backup present", "no neon-prod-*.dump"]];
  return [
    [backup.ageH <= BACKUP_MAX_AGE_H ? "PASS" : "FAIL", `backup newer than ${BACKUP_MAX_AGE_H} h`, `${backup.file}, ${backup.ageH.toFixed(1)} h old`],
    [backup.want && backup.want === backup.got ? "PASS" : "FAIL", "backup matches its SHA256SUMS entry", backup.want ? backup.got.slice(0, 12) : "no SHA256SUMS entry"],
  ];
}

export function envCheck(phase, missing) {
  const name = "Production env has the operations/R2/admin names";
  if (missing.length === 0) return ["PASS", name, "all present"];
  return [phase === "pre-release" ? "PENDING" : "FAIL", name, `missing: ${missing.join(", ")}${phase === "pre-release" ? " (set in runbook step 5)" : ""}`];
}

export function exitCodeFor(phase, lines) {
  const allowed = phase === "pre-release" ? ["PASS", "PENDING"] : ["PASS"];
  return lines.length > 0 && lines.every((l) => allowed.includes(l.split(" ")[0])) ? 0 : 1;
}
