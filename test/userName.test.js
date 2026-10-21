import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import { updateName } from "../src/controllers/usersController.js";
import { updateNameSchema } from "../src/schemas/userSchemas.js";

test("display name validation trims whitespace and enforces the existing name limits", () => {
  assert.deepEqual(updateNameSchema.parse({ name: "  Jamie  " }), { name: "Jamie" });
  assert.equal(updateNameSchema.safeParse({ name: "   " }).success, false);
  assert.equal(updateNameSchema.safeParse({ name: "a".repeat(81) }).success, false);
});

test("updating a display name saves it and returns the updated user", async () => {
  const originalFindById = User.findById;
  const user = {
    _id: "user-id",
    name: "Old name",
    async save() { return this; }
  };
  User.findById = async () => user;

  try {
    let responseBody;
    await updateName(
      { body: { name: "  New name " }, user: { _id: "user-id" } },
      { json(body) { responseBody = body; return body; } }
    );

    assert.equal(user.name, "New name");
    assert.deepEqual(responseBody.data.user, { id: "user-id", name: "New name" });
  } finally {
    User.findById = originalFindById;
  }
});

test("display name update preserves database errors", async () => {
  const originalFindById = User.findById;
  const saveError = new Error("Database save failed");
  User.findById = async () => ({
    _id: "user-id",
    name: "Old name",
    async save() { throw saveError; }
  });

  try {
    await assert.rejects(
      updateName(
        { body: { name: "New name" }, user: { _id: "user-id" } },
        { json() {} }
      ),
      (error) => error === saveError
    );
  } finally {
    User.findById = originalFindById;
  }
});
