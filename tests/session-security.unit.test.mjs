import assert from "node:assert/strict";
import test from "node:test";
import { requireSessionSecret } from "../server/session-security.mjs";

test("rejects a missing session secret in production", () => {
  assert.throws(
    () => requireSessionSecret({ NODE_ENV: "production" }),
    Error,
  );
});

test("rejects an empty or whitespace-only session secret", () => {
  for (const value of ["", " ", "\t\n"]) {
    assert.throws(
      () =>
        requireSessionSecret({
          NODE_ENV: "production",
          SESSION_SECRET: value,
        }),
      Error,
    );
  }
});

test("development still requires an explicitly provided secret", () => {
  assert.throws(
    () =>
      requireSessionSecret({
        NODE_ENV: "development",
        SESSION_SECRET: " \n\t ",
      }),
    Error,
  );
});

test("returns a valid provided secret unchanged", () => {
  const secret = "test-only-session-secret";

  assert.equal(
    requireSessionSecret({
      NODE_ENV: "development",
      SESSION_SECRET: secret,
    }),
    secret,
  );
});

test("validation errors do not leak secret values", () => {
  const secret = "sensitive-value-that-must-not-appear";
  let error;

  try {
    requireSessionSecret({
      NODE_ENV: "production",
      SESSION_SECRET: " \t ",
    });
  } catch (caught) {
    error = caught;
  }

  assert(error instanceof Error);
  assert.equal(error.message.includes(secret), false);
});