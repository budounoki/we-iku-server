// Compatibility entrypoint.  It deliberately has no alternate server/URL
// mode; all authorization tests go through the managed launcher.
import { assertNoCallerOverrides, runManagedTests } from "./run-managed-tests.mjs";

assertNoCallerOverrides();
try {
  await runManagedTests(["authz"]);
} catch {
  console.error("managed authorization tests failed");
  process.exitCode = 1;
}
