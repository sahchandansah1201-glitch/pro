import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hashPassword,
  verifyPasswordHash,
} from "./auth-crypto.mjs";

test("hashPassword creates a verifiable scrypt hash", () => {
  const hash = hashPassword("demo-password", {
    salt: "stage4c-demo-salt",
  });

  assert.match(hash, /^\$scrypt\$16384\$8\$1\$/);
  assert.equal(verifyPasswordHash("demo-password", hash), true);
  assert.equal(verifyPasswordHash("wrong-password", hash), false);
});

test("verifyPasswordHash rejects malformed hashes safely", () => {
  assert.equal(verifyPasswordHash("x", ""), false);
  assert.equal(verifyPasswordHash("x", "$argon2$bad"), false);
});
