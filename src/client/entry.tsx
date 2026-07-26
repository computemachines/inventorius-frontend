import * as React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
// import ReactModal from "react-modal";
import {
  createFrontloadState,
  FrontloadState,
  FrontloadProvider,
} from "react-frontload";
import App from "../components/App";
import * as Sentry from "@sentry/react";
import { BrowserRouter } from "react-router-dom";
import { ApiContext, ApiClient } from "../api-client/api-client";
import { sentryRelease } from "../build-info";

declare global {
  /**
   * Window interface items inserted by server renderer.
   */
  interface Window {
    __FRONTLOAD_SERVER_STATE?: FrontloadState;
    __DEV_MODE?: boolean;
  }
  /**
   * NodeModule interface added by webpack HMR plugin
   * @internal
   * TODO: Check what this is for, why I put it here.
   */
  interface NodeModule {
    hot?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

/**
 * Set up sentry error reporting.
 */
function init_sentry() {
  const runtime = window.__INVENTORIUS_RUNTIME__;
  const dsn = runtime?.sentry_browser_dsn;
  if (!runtime || !dsn) return;

  Sentry.init({
    dsn,
    release: sentryRelease(runtime.build.revision),
    environment: runtime.build.environment,
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
        component: runtime.build.component,
        component_version: runtime.build.version,
        build_revision: runtime.build.revision,
        product_release: runtime.build.product_release,
        deployment_environment: runtime.build.environment,
        build_time: runtime.build.build_time,
      },
    },
  });
}

/**
 * Client-side react app.
 * @param props
 * @param props.frontloadState - A FrontloadState object returned by createFrontloadState
 * @returns client side app wrapped in a BrowserRouter and Providers
 */
function ClientApp({
  frontloadState,
}: {
  frontloadState: FrontloadState;
}): React.ReactElement {
  return (
    <BrowserRouter>
      <FrontloadProvider initialState={frontloadState}>
        <ApiContext.Provider value={frontloadState.context.api}>
          <App />
        </ApiContext.Provider>
      </FrontloadProvider>
    </BrowserRouter>
  );
}

/**
 * Client-side one-time setup. Either renders to or hydrates the DOM.
 * @remarks
 * Immediately invoked function.
 */
function initialize_app() {
  init_sentry();

  // Browser requests stay on the origin that served the frontend. Webpack,
  // local nginx, or production Traefik can then route /api to the API service.
  const api = new ApiClient();

  if (window.__FRONTLOAD_SERVER_STATE) {
    // hydrating the component tree that the server preloaded/prerendered

    const frontloadState = createFrontloadState.client({
      // this context object is passed as the only argument to the callbacks collected by the useFrontload hook
      context: { api },

      // data returned by frontloadServerRender. This contains the prefetched data.
      serverRenderedData: window.__FRONTLOAD_SERVER_STATE,
      logging: window.__DEV_MODE,
    });

    hydrateRoot(
      document.getElementById("react-root")!,
      <ClientApp frontloadState={frontloadState} />
    );
  } else {
    // rendering fresh without server preloading/prerendering
    // This should NEVER happen in production.

    // same as the hydrating case, except there is no server rendered data
    const frontloadState = createFrontloadState.client({
      serverRenderedData: {},
      context: { api },
      logging: true,
    });
    frontloadState.setFirstRenderDoneOnClient();

    const root = createRoot(document.getElementById("react-root")!);
    root.render(<ClientApp frontloadState={frontloadState} />);

    if (module.hot) {
      // hot module reloading (HMR).
      // don't understand this, but it seems to work. see webpack configs for HMR plugin
      module.hot.accept("../components/App.tsx", function () {
        console.log("Accepted new module");
        root.render(<ClientApp frontloadState={frontloadState} />);
      });
    }
  }
}
initialize_app();
