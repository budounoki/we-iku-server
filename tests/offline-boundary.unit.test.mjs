import { test } from "node:test";
import assert from "node:assert/strict";

test("DB/application/socket/subprocess imports stop before evaluation", async () => {
  for (const specifier of ["pg", "../server/db.ts", "../server/auth.ts", "node:net", "node:http", "node:https", "node:child_process"]) {
    await assert.rejects(import(specifier), /OFFLINE_IMPORT_BLOCKED/);
  }
});

test("fetch and WebSocket are replaced before test loading", async () => {
  await assert.rejects(fetch("https://synthetic.invalid"), /OFFLINE_NETWORK_BLOCKED/);
  assert.throws(() => new WebSocket("wss://synthetic.invalid"), /OFFLINE_NETWORK_BLOCKED/);
});