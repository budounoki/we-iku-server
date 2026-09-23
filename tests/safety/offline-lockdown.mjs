import { register } from "node:module";

// Installed before any test module is evaluated. pg, application modules,
// sockets, HTTP clients and subprocess modules are outside the allowlist.
register("./offline-loader.mjs", import.meta.url);
globalThis.fetch = async () => { throw new Error("OFFLINE_NETWORK_BLOCKED"); };
globalThis.WebSocket = class {
  constructor() { throw new Error("OFFLINE_NETWORK_BLOCKED"); }
};