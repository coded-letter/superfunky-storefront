import assert from "node:assert/strict";
import test from "node:test";
import {
  HttpRequestError,
  isRetryableHttpStatus,
  shouldRetryRequestError,
} from "./requestRetry.ts";

test("request polling retries transient failures only", () => {
  assert.equal(isRetryableHttpStatus(0), true);
  assert.equal(isRetryableHttpStatus(500), true);
  assert.equal(isRetryableHttpStatus(403), false);
  assert.equal(shouldRetryRequestError(new TypeError("Network unavailable")), true);
  assert.equal(shouldRetryRequestError(new HttpRequestError("Timed out", 408)), true);
  assert.equal(shouldRetryRequestError(new HttpRequestError("Rate limited", 429)), true);
  assert.equal(shouldRetryRequestError(new HttpRequestError("Unavailable", 503)), true);
  assert.equal(shouldRetryRequestError(new HttpRequestError("Forbidden", 403)), false);
  assert.equal(shouldRetryRequestError(new HttpRequestError("Not found", 404)), false);
});
