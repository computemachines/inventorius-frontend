/** Main entry for node server. */
import * as React from "react";
import { renderToString } from "react-dom/server";
import * as express from "express";
import { docopt } from "docopt";
import {
  createFrontloadState,
  FrontloadProvider,
  frontloadServerRender,
  type FrontloadState,
} from "react-frontload";
import { StaticRouter } from "react-router-dom";
import * as path from "path";
import * as cors from "cors";
import { randomBytes } from "crypto";

import * as Sentry from "@sentry/node";

import App from "../components/App";
import { ApiClient } from "../api-client/api-client";
import { sentryRelease } from "../build-info";
import { runtimeBuildInfo } from "./runtime-build-info";
import {
  ServerStatusContext,
  type ServerStatus,
} from "../components/primitives/ServerStatusContext";

const API_HOSTNAME = process.env.API_HOSTNAME || "http://localhost:8000";

const doc = `
Usage:
  server.bundle.js [options]

Options:
  -h --help                     Show this screen.
  --version                     Show version.
  --dev                         Tell client.ts to be dev mode. Put __DEV_MODE=true on window.
  -p <port>, --port <port>      Listen port. [default: 80]
  --noclient                    Do not send client bundle. Only perform server rendering.
`;

const args = docopt(doc, { version: "1.0.0" });
const port = parseInt(args["--port"] || 80);
const dev: boolean = args["--dev"];
const noclient: boolean = args["--noclient"];

const app = express();
const sentryDsn = process.env.SENTRY_SSR_DSN;
const initialBuildInfo = runtimeBuildInfo();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: sentryRelease(initialBuildInfo.revision),
    environment: initialBuildInfo.environment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.contexts;
      delete event.extra;
      delete event.breadcrumbs;
      return event;
    },
    initialScope: {
      tags: {
        component: initialBuildInfo.component,
        component_version: initialBuildInfo.version,
        build_revision: initialBuildInfo.revision,
        build_time: initialBuildInfo.build_time,
      },
    },
  });
}

// In Sentry v10+, request/tracing handling is automatic via expressIntegration

/**
 * Generate HTML from template.
 * @param app - The complete server-side-rendered app.
 * @param frontloadServerData - The cached data for frontload.
 * @param dev - Development flag
 * @param noclient - Disable all client side js for testing server rendering.
 * @returns The complete HTML page.
 */
function htmlTemplate(
  app: string,
  frontloadServerData,
  nonce,
  buildInfo,
  dev = false,
  noclient = false
) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Inventorius</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=no" />
        ${!dev ? '<link rel="stylesheet" href="/assets/client.css" />' : ""}
    </head>
    <body>
        <div id="react-root">${app}</div>
        <script nonce="${nonce}">
            window.__INVENTORIUS_RUNTIME__ = ${JSON.stringify({
              build: buildInfo,
              sentry_browser_dsn: process.env.SENTRY_BROWSER_DSN || undefined,
            }).replace(/</g, "\\u003c")};
            window.__DEV_MODE = ${dev}
              // WARNING: See the following for security issues around embedding JSON in HTML:
              // http://redux.js.org/recipes/ServerRendering.html#security-considerations
            window.__FRONTLOAD_SERVER_STATE = ${JSON.stringify(
              frontloadServerData
            ).replace(/</g, "\\u003c")}
        </script>
        ${!noclient ? `<script nonce="${nonce}" src="/assets/client.bundle.js"></script>` : ""}
    </body>
    </html>`;
}

// TODO: have assets served directly by nginx. issues/1
app.use(
  "/assets",
  express.static(path.join(__dirname, "assets"), { fallthrough: true })
);
app.get("/assets/*", (_, res) => res.sendStatus(404)); // fallthrough

app.get("/build.json", (_, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(runtimeBuildInfo());
});

app.get("/*", cors(), async function (req, res) {
  const start = Date.now();
  const buildInfo = runtimeBuildInfo();
  console.log(`[ssr] ${req.method} ${req.url}`);

  const frontloadState = createFrontloadState.server({
    context: {
      api: new ApiClient(API_HOSTNAME, { cookie: req.headers.cookie }),
    },
    logging: dev,
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  const nonce = randomBytes(18).toString("base64");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "publickey-credentials-create=(self), publickey-credentials-get=(self)"
  );

  let statusState: ServerStatus = {
    statusCode: 200,
  };

  try {
    const { rendered, data } = await frontloadServerRender({
      frontloadState,
      render: () =>
        renderToString(
          <StaticRouter location={req.url}>
            <FrontloadProvider initialState={frontloadState}>
              <ServerStatusContext value={statusState}>
                <App />
              </ServerStatusContext>
            </FrontloadProvider>
          </StaticRouter>
        ),
    });

    console.log(`[ssr] ${req.url} → ${statusState.statusCode} (${Date.now() - start}ms)`);
    const complete_page = htmlTemplate(
      rendered,
      data,
      nonce,
      buildInfo,
      dev,
      noclient
    );
    res.status(statusState.statusCode).send(complete_page);
  } catch (err) {
    console.error(`[ssr] ${req.url} → ERROR (${Date.now() - start}ms)`, err);
    Sentry.withScope((scope) => {
      scope.setTag("product_release", buildInfo.product_release);
      scope.setTag("deployment_environment", buildInfo.environment);
      Sentry.captureException(err);
    });
    res.status(500).send("Server render error");
  }
});

// The error handler must be before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.listen(port);
