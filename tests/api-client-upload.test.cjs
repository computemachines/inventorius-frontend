const assert = require("node:assert/strict");
const test = require("node:test");

const crossFetch = require("cross-fetch");
const originalFetch = crossFetch.default;

test.after(() => {
  crossFetch.default = originalFetch;
});

test("uploads through the shared client with CSRF and multipart FormData", async () => {
  let request;
  crossFetch.default = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 201,
      json: async () => ({
        Id: "/api/files/file-id",
        state: {
          id: "file-id",
          filename: "attachment.png",
          content_type: "image/png",
          size: 8,
          is_image: true,
        },
      }),
    };
  };

  const { ApiClient } = require("../src/api-client/api-client");
  const api = new ApiClient();
  api.setCsrfToken("csrf-token");
  const file = new File(["contents"], "attachment.png", {
    type: "image/png",
  });

  const uploaded = await api.uploadFile(file);

  assert.equal(uploaded.state.id, "file-id");
  assert.equal(request.url, "/api/files");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.get("X-CSRF-Token"), "csrf-token");
  assert.equal(request.options.headers.has("Content-Type"), false);
  assert.equal(request.options.body.get("file"), file);
});

test("surfaces an upload validation error from the API", async () => {
  crossFetch.default = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      "invalid-params": [{ reason: "File type not allowed" }],
    }),
  });

  const { ApiClient } = require("../src/api-client/api-client");
  const api = new ApiClient();

  await assert.rejects(
    api.uploadFile(new File(["contents"], "attachment.txt")),
    /File type not allowed/
  );
});
