import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const script = readFileSync("scripts/migrate.sh", "utf8");

test("the migration runner includes every schema migration exactly once", () => {
  const included = [...script.matchAll(/^\\i supabase\/migrations\/(.+)$/gm)].map((match) => match[1]);
  const migrations = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql"));
  assert.deepEqual([...included].sort(), migrations.sort());
  assert.equal(new Set(included).size, included.length);
  for (const migration of included) {
    const version = migration.split("_")[0];
    assert.ok(script.includes(`where version='${version}'`), `${migration} needs a ledger guard`);
    assert.ok(script.includes(`values('${version}')`), `${migration} needs a ledger record`);
  }
});

test("customer profiles precede ownership links and realtime follows kitchens and riders", () => {
  assert.ok(script.indexOf("\\i supabase/migrations/202610130001") < script.indexOf("\\i supabase/migrations/202610120001"));
  assert.ok(script.indexOf("\\i supabase/migrations/202610190001") < script.indexOf("\\i supabase/migrations/202610200001"));
  assert.ok(script.indexOf("\\i supabase/migrations/202610200001") < script.indexOf("\\i supabase/migrations/202611040001"));
});

test("migration execution refuses an unconfirmed database target", () => {
  const result = spawnSync("bash", ["scripts/migrate.sh"], {
    env: { ...process.env, APPLY_DB_MIGRATIONS: "0", SUPABASE_DB_URL: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Select and confirm the target project/);
});
