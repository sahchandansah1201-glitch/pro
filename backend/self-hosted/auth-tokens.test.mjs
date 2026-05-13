import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthConfigError,
  AuthTokenError,
  extractBearerToken,
  signAccessToken,
  verifyAccessToken,
} from "./auth-tokens.mjs";

const secret = "stage4c-token-test-secret";

test("signAccessToken and verifyAccessToken round-trip role claims", () => {
  const token = signAccessToken({
    subject: "user-1",
    issuer: "dermatolog-pro-test",
    secret,
    roles: ["doctor"],
    clinicIds: ["clinic-1"],
    nowSeconds: 100,
    expiresInSeconds: 3600,
  });
  const claims = verifyAccessToken({
    token,
    issuer: "dermatolog-pro-test",
    secret,
    nowSeconds: 101,
  });

  assert.equal(claims.userId, "user-1");
  assert.deepEqual(claims.roles, ["doctor"]);
  assert.deepEqual(claims.clinicIds, ["clinic-1"]);
  assert.equal(claims.expiresAt, 3700);
});

test("verifyAccessToken rejects tampered, expired, and misconfigured tokens", () => {
  const token = signAccessToken({
    subject: "user-1",
    issuer: "issuer-a",
    secret,
    nowSeconds: 100,
    expiresInSeconds: 1,
  });

  assert.throws(
    () => verifyAccessToken({ token: `${token}x`, issuer: "issuer-a", secret, nowSeconds: 100 }),
    AuthTokenError,
  );
  assert.throws(
    () => verifyAccessToken({ token, issuer: "issuer-a", secret, nowSeconds: 101 }),
    AuthTokenError,
  );
  assert.throws(
    () => signAccessToken({ subject: "u", issuer: "i", secret: "short" }),
    AuthConfigError,
  );
});

test("extractBearerToken accepts Authorization header variants only", () => {
  assert.equal(extractBearerToken({ authorization: "Bearer abc.def" }), "abc.def");
  assert.equal(extractBearerToken({ Authorization: "bearer token" }), "token");
  assert.equal(extractBearerToken({ authorization: "Basic nope" }), "");
});
