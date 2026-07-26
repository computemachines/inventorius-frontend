declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      COMPONENT_VERSION: string;
      BUILD_REVISION: string;
      BUILD_TIME: string;
      PRODUCT_RELEASE?: string;
      DEPLOYMENT_ENVIRONMENT?: string;
      SENTRY_BROWSER_DSN?: string;
      SENTRY_SSR_DSN?: string;
      INVENTORIUS_RELEASE_MANIFEST_PATH?: string;
    }
  }

  interface Window {
    __INVENTORIUS_RUNTIME__?: {
      build: import("./build-info").BuildInfo;
      sentry_browser_dsn?: string;
    };
  }
}

export {}
