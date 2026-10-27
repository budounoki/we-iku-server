import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupAuth } from "./auth";
import { registerFamilyIdMigrationRoutes } from "./familyIdMigration";
import { registerPremiumRoutes, startPremiumRevalidationCron } from "./premium";
import { registerAnnouncementRoutes } from "./announcements";
import { registerCampaignRoutes } from "./campaign";
import { registerPhotoRoutes } from "./photos/routes";
import { pool } from "./db";
import { requireSessionSecret } from "./session-security.mjs";
import { createServer } from "http";

// Fail fast: an unset SESSION_SECRET must stop the server before it starts
// accepting logins with a guessable fallback secret.
requireSessionSecret(process.env);

const app = express();
const httpServer = createServer(app);

// Managed test runners (tests/run-managed-tests.mjs) spawn this server as a
// detached IPC child; they need loopback binding and the actual bound port
// announced from our own listen callback.
const managedTestServer =
  process.env.MANAGED_TEST_SERVER_IPC === "1"
  && Boolean(process.env.TEST_RUN_CONTEXT_FILE);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.set("trust proxy", 1);

// Gzip all responses — /api/logs for a large family is ~3.7MB of JSON
// uncompressed, which made the きろく tab crawl on mobile connections
// (user-reported 2026-09-21). Compresses to a few hundred KB.
app.use(compression());

// Allow requests from Expo dev server and mobile apps.
app.use(
  cors({
    origin: true,           // reflect request origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Family-Id"],
  }),
);

// 写真カレンダーのアップロードだけ大きな本文を許可する（base64 の写真で最大 約14MB）。
// 全体の上限（既定 100kb）は広げない。先に解析されるため、下の全体用パーサーは何もしない。
app.use("/api/photo-calendar", express.json({ limit: "15mb" }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Allow popup-based OAuth flows (e.g. Google via expo-auth-session) to
// communicate back to the opener window without being blocked by COOP.
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await setupAuth(app);
  registerFamilyIdMigrationRoutes(app);
  registerPremiumRoutes(app);
  registerAnnouncementRoutes(app);
  registerCampaignRoutes(app);
  registerPhotoRoutes(app, pool);
  await registerRoutes(httpServer, app);
  if (!managedTestServer) startPremiumRevalidationCron();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (managedTestServer) {
      // Test-server stderr may be surfaced in reports; never echo raw
      // errors (they can contain credentials or request payloads).
      console.error("Managed test server request failed");
    } else {
      console.error("Internal Server Error:", err);
    }

    if (res.headersSent) {
      return next(managedTestServer ? new Error("Managed test server request failed") : err);
    }

    return res.status(status).json({
      message: managedTestServer ? "Internal Server Error" : message,
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else if (process.env.EXPO_PROXY_PORT) {
    // When EXPO_PROXY_PORT is set, proxy non-API requests to the Expo dev
    // server so a single ngrok tunnel on this port can serve both the API
    // and the mobile web app.
    const { createProxyMiddleware } = await import("http-proxy-middleware");
    const expoTarget = `http://localhost:${process.env.EXPO_PROXY_PORT}`;
    app.use(
      createProxyMiddleware({
        target: expoTarget,
        changeOrigin: true,
        ws: true,
        logger: console,
      }),
    );
    log(`proxying non-API requests to Expo dev server at ${expoTarget}`);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    { port, host: managedTestServer ? "127.0.0.1" : "0.0.0.0" },
    () => {
      const address = httpServer.address();
      const boundPort = address && typeof address !== "string" ? address.port : port;
      log(`serving on port ${boundPort}`);
      if (
        managedTestServer
        && typeof process.send === "function"
        && process.connected
      ) {
        try {
          process.send({
            type: "managed-server-listening",
            pid: process.pid,
            port: boundPort,
          }, undefined, undefined, () => undefined);
        } catch {
          // The managed parent may have gone away during startup.
        }
      }
    },
  );
})();
