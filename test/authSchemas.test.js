import test from "node:test";
import assert from "node:assert/strict";
import { registerSchema, loginSchema, googleSchema } from "../src/schemas/authSchemas.js";

test("registration trims the name and normalizes email", () => {
  const result = registerSchema.parse({
    name: "  Jamie  ",
    email: "JAMIE@EXAMPLE.COM ",
    password: "password-123"
  });
  assert.equal(result.name, "Jamie");
  assert.equal(result.email, "jamie@example.com");
});

test("registration rejects short passwords and invalid email addresses", () => {
  assert.equal(
    registerSchema.safeParse({ name: "Jamie", email: "not-an-email", password: "short" }).success,
    false
  );
});

test("login accepts non-empty passwords and normalizes email", () => {
  assert.deepEqual(
    loginSchema.parse({ email: "JAMIE@example.com", password: "x" }),
    { email: "jamie@example.com", password: "x" }
  );
});

test("Google sign-in requires a credential", () => {
  assert.equal(googleSchema.safeParse({ credential: "id-token" }).success, true);
  assert.equal(googleSchema.safeParse({ credential: "" }).success, false);
});
