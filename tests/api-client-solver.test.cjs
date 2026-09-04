const assert = require("node:assert/strict");
const test = require("node:test");

const crossFetch = require("cross-fetch");
const originalFetch = crossFetch.default;

test.after(() => {
  crossFetch.default = originalFetch;
});

test("submits a temporary solver query through authenticated transport", async () => {
  let request;
  crossFetch.default = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        state: { result: { kind: "expression-bounds", status: "solved" } },
      }),
    };
  };

  const { ApiClient } = require("../src/api-client/api-client");
  const api = new ApiClient("https://inventory.test");
  api.setCsrfToken("csrf-token");
  const command = {
    snapshot: { revision: 1, variables: [], constraints: [] },
    overlay: { variables: [], constraints: [] },
    query: { kind: "counterfactual-feasibility" },
  };

  const response = await api.evaluateSolverQuery(command);

  assert.equal(request.url, "https://inventory.test/api/solver/query");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.get("X-CSRF-Token"), "csrf-token");
  assert.deepEqual(JSON.parse(request.options.body), command);
  assert.equal(response.state.result.status, "solved");
});
