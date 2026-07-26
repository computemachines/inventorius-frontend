import { readFileSync } from "fs";

import { staticBuildInfo, type BuildInfo } from "../build-info";

type StaticBuildInfo = typeof staticBuildInfo;
type ReadFile = (path: string, encoding: "utf8") => string;

interface ReleaseManifest {
  schema_version: 1;
  product_release: string;
  components: {
    frontend: {
      revision: string;
    };
  };
}

function isMatchingReleaseManifest(
  value: unknown,
  revision: string
): value is ReleaseManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const manifest = value as Record<string, unknown>;
  return (
    manifest.schema_version === 1 &&
    typeof manifest.product_release === "string" &&
    manifest.product_release.trim().length > 0 &&
    typeof manifest.components === "object" &&
    manifest.components !== null &&
    !Array.isArray(manifest.components) &&
    typeof (manifest.components as Record<string, unknown>).frontend === "object" &&
    (manifest.components as { frontend: { revision?: unknown } }).frontend !== null &&
    (manifest.components as { frontend: { revision?: unknown } }).frontend.revision === revision
  );
}

export function resolveRuntimeBuildInfo(
  build: StaticBuildInfo,
  environ: NodeJS.ProcessEnv = process.env,
  readFile: ReadFile = readFileSync
): BuildInfo {
  const fallbackProductRelease = environ.PRODUCT_RELEASE || build.version;
  const manifestPath = environ.INVENTORIUS_RELEASE_MANIFEST_PATH;
  let productRelease = fallbackProductRelease;

  if (manifestPath) {
    try {
      const manifest = JSON.parse(readFile(manifestPath, "utf8"));
      if (isMatchingReleaseManifest(manifest, build.revision)) {
        productRelease = manifest.product_release;
      }
    } catch {
      // A release manifest is optional. Never make a malformed, stale, or
      // temporarily unavailable controller file take down frontend requests.
    }
  }

  return {
    ...build,
    product_release: productRelease,
    environment: environ.DEPLOYMENT_ENVIRONMENT || environ.NODE_ENV || "development",
  };
}

export function runtimeBuildInfo(): BuildInfo {
  return resolveRuntimeBuildInfo(staticBuildInfo);
}
