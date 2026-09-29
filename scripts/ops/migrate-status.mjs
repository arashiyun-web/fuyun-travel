// Interprets `prisma migrate status` for the release guard. Prisma exits 1 both when migrations are
// merely pending and when it cannot reach or read the database, so the exit code alone is not enough:
//   ok   — exit 0 and "Database schema is up to date", or
//        — exit 1 with exactly the expected migrations listed as not yet applied and nothing failed.
// Anything else (connection/auth error, failed or unexpected migrations, no output) is not ok.
const NAME_RE = /^\d{12}_[a-z0-9_]+$/;

export function evaluateMigrateStatus({ status, stdout = "", stderr = "" }, expectedPending) {
  const out = `${stdout}\n${stderr}`;
  if (/have failed|P3009|P3018/i.test(out)) return { ok: false, pending: [], reason: "a migration is recorded as failed" };
  if (status === 0 && /Database schema is up to date/.test(stdout)) return { ok: true, pending: [], reason: "up to date" };
  if (status === 1 && /have not yet been applied/.test(stdout)) {
    const after = stdout.split(/have not yet been applied:?/)[1] || "";
    const pending = after.split(/\r?\n/).map((l) => l.trim()).filter((l) => NAME_RE.test(l));
    const expected = [...expectedPending].sort();
    const same = pending.length === expected.length && [...pending].sort().every((name, i) => name === expected[i]);
    return same
      ? { ok: true, pending, reason: "only the expected migrations are pending" }
      : { ok: false, pending, reason: `pending set differs from expected (${pending.join(", ") || "none parsed"})` };
  }
  const code = (out.match(/\bP\d{4}\b/) || [])[0];
  return { ok: false, pending: [], reason: `prisma migrate status failed (exit ${status}${code ? `, ${code}` : ""})` };
}
