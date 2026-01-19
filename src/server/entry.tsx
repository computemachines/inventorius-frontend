/** Main entry for node server. */
import * as React from "react";
import { renderToString } from "react-dom/server";
import * as express from "express";
import { docopt } from "docopt";
import {
  createFrontloadState,
  FrontloadProvider,
  frontloadServerRender,
  FrontloadState,
} from "react-frontload";
import { StaticRouter } from "react-router-dom";
import * as path from "path";
import * as cors from "cors";

import * as Sentry from "@sentry/node";

import App from "../components/App";
import { ApiClient } from "../api-client/api-client";
import { version } from "os";

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

// TODO: move hardcoded dsn to config file
Sentry.init({
  dsn: "https://841e6ad3756e472085e3e924a0ded641@o1103275.ingest.sentry.io/6150241",
  release: process.env.VERSION,
  environment: process.env.NODE_ENV,
  integrations: [
    // enable HTTP calls tracing
    Sentry.httpIntegration(),
    // enable Express.js middleware tracing
    Sentry.expressIntegration(),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

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
  dev = false,
  noclient = false
) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Inventorius</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=no" />
        <link rel="stylesheet" href="/assets/main.css" />
    </head>
    <body>
        <div id="react-root">${app}</div>
        <script>
            window.__DEV_MODE = ${dev}
              // WARNING: See the following for security issues around embedding JSON in HTML:
              // http://redux.js.org/recipes/ServerRendering.html#security-considerations
            window.__FRONTLOAD_SERVER_STATE = ${JSON.stringify(
              frontloadServerData
            ).replace(/</g, "\\u003c")}
        </script>
        ${!noclient ? '<script src="/assets/client.bundle.js"></script>' : ""}
    </body>
    </html>`;
}

// TODO: have assets served directly by nginx. issues/1
app.use(
  "/assets",
  express.static(path.join(__dirname, "assets"), { fallthrough: true })
);
app.get("/assets/*", (_, res) => res.sendStatus(404)); // fallthrough

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

app.get("/*", cors(), async function (req, res) {
  dev && console.log(req.path);

  const frontloadState = createFrontloadState.server({
    context: { api: new ApiClient(API_HOSTNAME) },
    logging: dev,
  });

  try {
    // NOTE: In react-router v6+, StaticRouter no longer has context prop.
    // Redirect/status code handling would require data router (createStaticHandler).
    const { rendered, data } = await frontloadServerRender({
      frontloadState,
      render: () =>
        renderToString(
          <StaticRouter location={req.url}>
            <FrontloadProvider initialState={frontloadState}>
              <App />
            </FrontloadProvider>
          </StaticRouter>
        ),
    });

    const complete_page = htmlTemplate(rendered, data, dev, noclient);
    res.send(complete_page);
  } catch (err) {
    console.log("server render thrown exception");
    Sentry.captureException(err);
    console.error(err);
  }
});

// The error handler must be before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.listen(port);
