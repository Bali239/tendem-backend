import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import app from "../src/app.js";
import { ApiError } from "../src/utils/apiError.js";
import { ApiResponse } from "../src/utils/apiResponse.js";

test("ApiError carries an HTTP status and message", () => {
  const error = new ApiError(404, "Conversation not found");

  assert.equal(error.name, "ApiError");
  assert.equal(error.statusCode, 404);
  assert.equal(error.message, "Conversation not found");
});

test("ApiResponse creates the standard success envelope", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(new ApiResponse({ userId: "user-1" }))), {
    success: true,
    message: "Success",
    data: { userId: "user-1" }
  });
});

test("HTTP routes serialize success and expected errors consistently", async () => {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), {
      success: true,
      message: "Success",
      data: { status: "ok" }
    });

    const missingResponse = await fetch(`${baseUrl}/api/not-found`);
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(await missingResponse.json(), {
      success: false,
      message: "Not found"
    });

    const unauthorizedResponse = await fetch(`${baseUrl}/api/conversations`);
    assert.equal(unauthorizedResponse.status, 401);
    assert.deepEqual(await unauthorizedResponse.json(), {
      success: false,
      message: "Authentication required"
    });

    const blockedOriginResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Origin: "https://attacker.example" }
    });
    assert.equal(blockedOriginResponse.status, 403);
    assert.deepEqual(await blockedOriginResponse.json(), {
      success: false,
      message: "Request origin is not allowed"
    });

    const allowedOriginResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Origin: "http://localhost:3000" }
    });
    assert.equal(allowedOriginResponse.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
