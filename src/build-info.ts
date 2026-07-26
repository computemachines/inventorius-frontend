export interface BuildInfo {
  component: "inventorius-frontend";
  version: string;
  revision: string;
  product_release: string;
  environment: string;
  build_time: string;
}

export const COMPONENT = "inventorius-frontend" as const;
export const COMPONENT_VERSION = process.env.COMPONENT_VERSION;
export const BUILD_REVISION = process.env.BUILD_REVISION;
export const BUILD_TIME = process.env.BUILD_TIME;

export function sentryRelease(revision: string): string {
  return `${COMPONENT}@${revision}`;
}

export function runtimeBuildInfo(): BuildInfo {
  return {
    component: COMPONENT,
    version: COMPONENT_VERSION,
    revision: BUILD_REVISION,
    product_release: process.env.PRODUCT_RELEASE || COMPONENT_VERSION,
    environment: process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV,
    build_time: BUILD_TIME,
  };
}
