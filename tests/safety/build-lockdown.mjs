// Preload for type checking and bundling, never for application/test servers.
// Compilation may spawn compiler helpers, but it must not open a DB connection
// or start an HTTP server. The caller also supplies a fresh, minimal environment.
import net from "node:net";
import dgram from "node:dgram";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

function blocked() {
  throw new Error("BUILD_NETWORK_OR_SERVER_BLOCKED");
}

net.Socket.prototype.connect = blocked;
net.Server.prototype.listen = blocked;
net.connect = blocked;
net.createConnection = blocked;
dgram.createSocket = blocked;
http.request = blocked;
http.get = blocked;
https.request = blocked;
https.get = blocked;
globalThis.fetch = blocked;
globalThis.WebSocket = class {
  constructor() { blocked(); }
};
syncBuiltinESMExports();