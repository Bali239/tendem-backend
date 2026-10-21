import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { uploadAvatar } from "../src/middleware/multerm.middleware.js";
import { ApiError } from "../src/utils/apiError.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

test("avatar upload middleware validates file type, content, size, and count", async () => {
  const app = express();
  app.post("/avatar", uploadAvatar, (request, response, next) => {
    if (!request.file) return next(new ApiError(400, "Choose an avatar image to upload"));
    return response.json({ mimetype: request.file.mimetype, size: request.file.size });
  });
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/avatar`;
    const pngImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/hioAAAAASUVORK5CYII=",
      "base64"
    );

    const validForm = new FormData();
    validForm.append("avatar", new Blob([pngImage], { type: "image/png" }), "avatar.png");
    const validResponse = await fetch(url, { method: "POST", body: validForm });
    assert.equal(validResponse.status, 200);
    assert.deepEqual(await validResponse.json(), { mimetype: "image/png", size: pngImage.length });

    const spoofedForm = new FormData();
    spoofedForm.append("avatar", new Blob(["not an image"], { type: "image/png" }), "avatar.png");
    const spoofedResponse = await fetch(url, { method: "POST", body: spoofedForm });
    assert.equal(spoofedResponse.status, 415);
    assert.match((await spoofedResponse.json()).message, /valid JPEG, PNG, or WebP/);

    const unsupportedForm = new FormData();
    unsupportedForm.append("avatar", new Blob(["text"], { type: "text/plain" }), "avatar.txt");
    const unsupportedResponse = await fetch(url, { method: "POST", body: unsupportedForm });
    assert.equal(unsupportedResponse.status, 415);

    const largeForm = new FormData();
    largeForm.append("avatar", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
    const largeResponse = await fetch(url, { method: "POST", body: largeForm });
    assert.equal(largeResponse.status, 413);

    const emptyResponse = await fetch(url, { method: "POST", body: new FormData() });
    assert.equal(emptyResponse.status, 400);

    const multipleForm = new FormData();
    multipleForm.append("avatar", new Blob([pngImage], { type: "image/png" }), "one.png");
    multipleForm.append("avatar", new Blob([pngImage], { type: "image/png" }), "two.png");
    const multipleResponse = await fetch(url, { method: "POST", body: multipleForm });
    assert.equal(multipleResponse.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
