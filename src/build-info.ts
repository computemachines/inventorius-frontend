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

export const staticBuildInfo = {
  component: COMPONENT,
  version: COMPONENT_VERSION,
  revision: BUILD_REVISION,
  build_time: BUILD_TIME,
} as const;

export function sentryRelease(revision: string): string {
  return `${COMPONENT}@${revision}`;
}
