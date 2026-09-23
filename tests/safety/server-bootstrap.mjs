/*
 * This is the only bootstrap used for an application child owned by the
 * managed test launcher.  Authorization runs before the real app module is
 * evaluated, so its database imports cannot precede the guard.
 */
import "./require-managed.mjs";
await import("../../server/index.ts");
