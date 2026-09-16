const assert = require("node:assert/strict");
const test = require("node:test");
const crossFetch = require("cross-fetch");
const originalFetch = crossFetch.default;

test.after(() => { crossFetch.default = originalFetch; });

test("next bin accepts a read-only response and never submits a creation", async () => {
  const requests = [];
  crossFetch.default = async (url, options = {}) => {
    requests.push({ url, method: options.method || "GET" });
    return new Response(JSON.stringify({
      Id: "/api/next/bin", state: "BIN000001",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { ApiClient } = require("../src/api-client/api-client");
  const preview = await new ApiClient("https://inventory.test").getNextBin();
  assert.equal(preview.state, "BIN000001");
  assert.deepEqual(preview.operations, {});
  assert.deepEqual(requests, [{
    url: "https://inventory.test/api/next/bin", method: "GET",
  }]);
});
