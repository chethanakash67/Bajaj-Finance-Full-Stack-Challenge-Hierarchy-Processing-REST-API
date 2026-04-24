const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureJsonContentType, formatAppError } = require("../src/app");

test("malformed request body returns 400", async () => {
  const error = new SyntaxError("Unexpected end of JSON input");
  error.body = '{"data":';

  const response = formatAppError(error);

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.message, "Malformed JSON request body.");
});

test("non-array body returns 400", async () => {
  const error = new Error('Request body must contain a "data" array.');
  error.statusCode = 400;

  const response = formatAppError(error);

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.message, 'Request body must contain a "data" array.');
});

test("non-json content type returns 415", async () => {
  const response = ensureJsonContentType({
    is(type) {
      return type === "application/json" ? false : null;
    },
  });

  assert.equal(response.message, "Content-Type must be application/json.");
});
