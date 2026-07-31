const assert = require("node:assert/strict");
const test = require("node:test");

const crossFetch = require("cross-fetch");
const originalFetch = crossFetch.default;

const typedCreate = (overrides = {}) => ({
  rel: "create-batch",
  method: "POST",
  href: "/advertised/batches",
  "Expects-a": "Batch patch",
  kind: "catalog.batch.create",
  request_schema: { name: "inventorius.batch-create", version: 1 },
  response_schema: { name: "inventorius.batch-creation-result", version: 1 },
  idempotency: {
    mode: "required",
    key: {
      in: "header",
      name: "Idempotency-Key",
      max_length: 200,
    },
    scope: "resource-creation",
    replay: "return-committed-result",
    mismatch: "conflict",
  },
  ...overrides,
});

test.after(() => {
  crossFetch.default = originalFetch;
});

test("decodes legacy and complete typed descriptors but rejects partial typing", () => {
  const { decodeRestOperation } = require("../src/api-client/data-models");
  const legacy = { rel: "bins", method: "GET", href: "/api/bins" };

  assert.deepEqual(decodeRestOperation(legacy), legacy);
  assert.deepEqual(decodeRestOperation(typedCreate()), typedCreate());
  assert.throws(
    () => decodeRestOperation({ ...legacy, kind: "catalog.batch.locations.read" }),
    /every typed field/,
  );
  assert.throws(
    () =>
      decodeRestOperation(
        typedCreate({ request_schema: { name: "inventorius.batch-create" } }),
      ),
    /positive integer/,
  );
});

test("JSON round-trip hydration rebuilds resources and validates operations", () => {
  const {
    ApiClient,
  } = require("../src/api-client/api-client");
  const {
    Batch,
    CallableRestOperation,
  } = require("../src/api-client/data-models");
  const api = new ApiClient("https://inventory.test");
  const wire = JSON.parse(JSON.stringify({
    kind: "batch",
    Id: "/api/batch/BAT000001",
    envelope_extension: "preserved",
    state: { id: "BAT000001" },
    operations: [
      {
        rel: "bins",
        method: "GET",
        href: "/api/batch/BAT000001/bins",
        hostname: "http://server-internal",
        kind: "catalog.batch.locations.read",
        request_schema: null,
        response_schema: {
          name: "inventorius.batch-locations",
          version: 1,
        },
        idempotency: { mode: "not-applicable" },
      },
    ],
  }));

  const hydrated = api.hydrate(wire);
  assert.ok(hydrated instanceof Batch);
  assert.equal(hydrated.Id, "/api/batch/BAT000001");
  assert.equal(hydrated.envelope_extension, "preserved");
  assert.ok(hydrated.operations.bins instanceof CallableRestOperation);
  assert.equal(hydrated.operations.bins.hostname, "https://inventory.test");

  delete wire.operations[0].response_schema;
  assert.throws(() => api.hydrate(wire), /every typed field/);
});

test("Batch creation follows the advertised href and injects idempotency through authenticated transport", async () => {
  const requests = [];
  const responses = [
    {
      ok: true,
      status: 200,
      json: async () => ({
        Id: "/api",
        state: { service: "Inventorius" },
        links: [],
        operations: [typedCreate()],
      }),
    },
    {
      ok: true,
      status: 201,
      json: async () => ({
        Id: "/api/batch/BAT000001",
        status: "batch created",
        state: { id: "BAT000001" },
      }),
    },
  ];
  crossFetch.default = async (url, options) => {
    requests.push({ url, options });
    return responses.shift();
  };
  const { ApiClient } = require("../src/api-client/api-client");
  const { isBatchCreateOperation } = require("../src/api-client/data-models");
  const api = new ApiClient("https://inventory.test", { cookie: "session=owner" });
  api.setCsrfToken("csrf-token");

  const root = await api.getApplicationRoot();
  const operation = root.operations.find((candidate) => candidate.rel === "create-batch");
  assert.equal(isBatchCreateOperation(operation), true);
  const ssrRoundTrip = api.hydrateOperation(
    JSON.parse(JSON.stringify(operation)),
  );
  assert.equal(isBatchCreateOperation(ssrRoundTrip), true);
  const result = await api.createBatch(ssrRoundTrip, { name: "Lot" }, "same-command");

  assert.equal(result.state.id, "BAT000001");
  assert.equal(requests[1].url, "https://inventory.test/advertised/batches");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.headers.get("Idempotency-Key"), "same-command");
  assert.equal(requests[1].options.headers.get("X-CSRF-Token"), "csrf-token");
  assert.equal(requests[1].options.headers.get("Cookie"), "session=owner");
  assert.deepEqual(JSON.parse(requests[1].options.body), { name: "Lot" });
});

test("legacy advertised Batch creation remains executable during rolling upgrades", async () => {
  const requests = [];
  const responses = [
    {
      ok: true,
      status: 200,
      json: async () => ({
        Id: "/api",
        state: { service: "Inventorius" },
        links: [],
        operations: [
          { rel: "create-batch", method: "POST", href: "/legacy/batches" },
        ],
      }),
    },
    {
      ok: true,
      status: 201,
      json: async () => ({
        status: "batch created",
        state: { id: "BAT000002" },
      }),
    },
  ];
  crossFetch.default = async (url, options) => {
    requests.push({ url, options });
    return responses.shift();
  };
  const { ApiClient } = require("../src/api-client/api-client");
  const { isBatchCreateOperation } = require("../src/api-client/data-models");
  const api = new ApiClient("https://inventory.test");

  const root = await api.getApplicationRoot();
  const operation = root.operations[0];
  assert.equal(isBatchCreateOperation(operation), true);
  await api.createBatch(operation, { name: "Legacy" }, "legacy-key");

  assert.equal(requests[1].url, "https://inventory.test/legacy/batches");
  assert.equal(requests[1].options.headers.get("Idempotency-Key"), "legacy-key");
});

test("typed Batch creation enforces its advertised idempotency-key limit", async () => {
  const { ApiClient } = require("../src/api-client/api-client");
  const { CallableRestOperation } = require("../src/api-client/data-models");
  const api = new ApiClient();
  const operation = new CallableRestOperation({
    ...typedCreate({
      idempotency: {
        ...typedCreate().idempotency,
        key: { in: "header", name: "Idempotency-Key", max_length: 3 },
      },
    }),
    hostname: "",
  });

  await assert.rejects(
    api.createBatch(operation, {}, "four"),
    /at most 3 characters/,
  );
});

test("Batch form contract refuses an absent or mismatched affordance", () => {
  const {
    CallableRestOperation,
    batchCreateAffordanceProblem,
  } = require("../src/api-client/data-models");

  assert.match(batchCreateAffordanceProblem(undefined), /did not advertise/);
  const legacy = new CallableRestOperation({
    rel: "create-batch",
    method: "POST",
    href: "/legacy/batches",
    hostname: "",
  });
  assert.equal(batchCreateAffordanceProblem(legacy), null);
  const mismatch = new CallableRestOperation({
    ...typedCreate({ kind: "catalog.sku.create" }),
    hostname: "",
  });
  assert.match(batchCreateAffordanceProblem(mismatch), /incompatible/);
  const valid = new CallableRestOperation({ ...typedCreate(), hostname: "" });
  assert.equal(batchCreateAffordanceProblem(valid), null);
});
