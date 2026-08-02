const assert = require("node:assert/strict");
const test = require("node:test");

const crossFetch = require("cross-fetch");
const originalFetch = crossFetch.default;

test.after(() => {
  crossFetch.default = originalFetch;
});

test("uses exact quantity contracts for reads, observations, and withdrawals", async () => {
  const requests = [];
  const quantityHolding = {
    stream_id: "QHDstream",
    holding: {
      batch_id: "BAT000001",
      location_id: "BIN000001",
      unit: "gram",
      packaging_configuration_id: null,
    },
    current_state_id: "QSTstate",
    last_sequence: 0,
    accepted_book: { status: "absent", quantity: null, unit: "gram" },
    feasible_physical: {
      status: "feasible",
      minimum: "0",
      preferred: "12.5",
      maximum: "25",
      capacity: null,
      unit: "gram",
      domain: "continuous",
      conflict_fact_ids: [],
    },
    history: [],
  };
  const responses = [
    {
      ok: true,
      json: async () => ({ state: { holdings: [quantityHolding] } }),
    },
    {
      ok: true,
      json: async () => ({ status: "recorded", state: { holding: quantityHolding } }),
    },
    {
      ok: true,
      json: async () => ({ status: "recorded", state: { holding: quantityHolding } }),
    },
  ];
  crossFetch.default = async (url, options) => {
    requests.push({ url, options });
    return responses.shift();
  };

  const { ApiClient } = require("../src/api-client/api-client");
  const api = new ApiClient("https://inventory.test");
  api.setCsrfToken("csrf-token");
  const identity = {
    batch_id: "BAT000001",
    location_id: "BIN000001",
    unit: "gram",
    domain: "continuous",
    packaging_configuration_id: null,
  };

  const listed = await api.getQuantityHoldings({
    batchId: identity.batch_id,
    locationId: identity.location_id,
  });
  await api.postQuantityObservation(
    {
      ...identity,
      claim: { domain: "continuous", basis: "estimated", preferred: "12.5" },
    },
    "observe-exact-decimal",
  );
  await api.postQuantityWithdrawal(
    { ...identity, amount: "1.25" },
    "withdraw-exact-decimal",
  );

  assert.equal(listed.kind, "quantity-holdings");
  assert.equal(
    requests[0].url,
    "https://inventory.test/api/quantity-holdings?batch_id=BAT000001&location_id=BIN000001",
  );
  assert.deepEqual(
    JSON.parse(requests[1].options.body).claim,
    { domain: "continuous", basis: "estimated", preferred: "12.5" },
  );
  assert.equal(requests[1].options.headers.get("Idempotency-Key"), "observe-exact-decimal");
  assert.equal(requests[1].options.headers.get("X-CSRF-Token"), "csrf-token");
  assert.equal(JSON.parse(requests[2].options.body).amount, "1.25");
  assert.equal(requests[2].options.headers.get("Idempotency-Key"), "withdraw-exact-decimal");
});
