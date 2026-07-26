const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveRuntimeBuildInfo,
} = require("../src/server/runtime-build-info");

const build = {
  component: "inventorius-frontend",
  version: "0.4.0",
  revision: "0123456789abcdef0123456789abcdef01234567",
  build_time: "2026-07-26T00:00:00Z",
};

function environ(path = "/release.json") {
  return {
    PRODUCT_RELEASE: "fallback-release",
    DEPLOYMENT_ENVIRONMENT: "staging",
    INVENTORIUS_RELEASE_MANIFEST_PATH: path,
  };
}

test("uses a matching schema-1 frontend release manifest", () => {
  const info = resolveRuntimeBuildInfo(build, environ(), () => JSON.stringify({
    schema_version: 1,
    product_release: "2026.07.26-rc1",
    components: { frontend: { revision: build.revision } },
  }));
  assert.equal(info.product_release, "2026.07.26-rc1");
  assert.equal(info.environment, "staging");
});

test("uses the environment fallback for a stale release manifest", () => {
  const info = resolveRuntimeBuildInfo(build, environ(), () => JSON.stringify({
    schema_version: 1,
    product_release: "wrong-release",
    components: { frontend: { revision: "stale" } },
  }));
  assert.equal(info.product_release, "fallback-release");
});

test("rejects the obsolete single-component manifest shape", () => {
  const info = resolveRuntimeBuildInfo(build, environ(), () => JSON.stringify({
    schema: 1,
    component: "frontend",
    revision: build.revision,
    product_release: "obsolete-release",
  }));
  assert.equal(info.product_release, "fallback-release");
});

test("uses the environment fallback for malformed JSON", () => {
  const info = resolveRuntimeBuildInfo(build, environ(), () => "not json");
  assert.equal(info.product_release, "fallback-release");
});

test("uses the environment fallback when the manifest is missing", () => {
  const info = resolveRuntimeBuildInfo(build, environ(), () => {
    throw new Error("ENOENT");
  });
  assert.equal(info.product_release, "fallback-release");
});
