import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import { removeAvatar } from "../src/controllers/usersController.js";

test("avatar removal persists the correct fallback even when Cloudinary cleanup fails", async () => {
  const originalFindById = User.findById;
  const originalConsoleError = console.error;
  const cloudinaryVariables = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ];
  const originalCloudinaryValues = new Map(
    cloudinaryVariables.map((name) => [name, process.env[name]])
  );

  for (const name of cloudinaryVariables) delete process.env[name];

  try {
    console.error = () => {};

    const cases = [
      {
        googleAvatar: "https://google.example/avatar.png",
        expectedAvatar: "https://google.example/avatar.png"
      },
      {
        googleAvatar: "",
        expectedAvatar: ""
      }
    ];

    for (const { googleAvatar, expectedAvatar } of cases) {
      let saved = false;
      const user = {
        avatar: "https://cloudinary.example/custom.png",
        avatarPublicId: "tandem/avatars/custom-image",
        googleAvatar,
        async save() {
          saved = true;
        }
      };
      User.findById = () => ({
        select: async () => user
      });

      let responseBody;
      await removeAvatar(
        { user: { _id: "user-id" } },
        { json(body) { responseBody = body; return body; } }
      );

      assert.equal(saved, true, "MongoDB save should finish before cleanup");
      assert.equal(user.avatar, expectedAvatar);
      assert.equal(user.avatarPublicId, "");
      assert.equal(responseBody.data.avatar, expectedAvatar);
    }
  } finally {
    User.findById = originalFindById;
    console.error = originalConsoleError;
    for (const [name, value] of originalCloudinaryValues) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("avatar removal preserves a database save error", async () => {
  const originalFindById = User.findById;
  const saveError = new Error("Database save failed");
  const user = {
    avatar: "https://cloudinary.example/custom.png",
    avatarPublicId: "tandem/avatars/custom-image",
    googleAvatar: "",
    async save() {
      throw saveError;
    }
  };
  User.findById = () => ({
    select: async () => user
  });

  try {
    await assert.rejects(
      removeAvatar({ user: { _id: "user-id" } }, { json() {} }),
      (error) => error === saveError
    );
    assert.equal(user.avatar, "");
    assert.equal(user.avatarPublicId, "");
  } finally {
    User.findById = originalFindById;
  }
});
