import assert from "node:assert/strict";
import test from "node:test";
import { createAuthClient } from "@neondatabase/auth";

test("patched Better Auth remains compatible with the Neon client surface Lmiere uses", () => {
  const client = createAuthClient("https://auth.example.test", {
    fetchOptions: { credentials: "include" },
  });

  for (const method of [
    client.signIn.email,
    client.signUp.email,
    client.emailOtp.verifyEmail,
    client.sendVerificationEmail,
    client.requestPasswordReset,
    client.resetPassword,
    client.getSession,
    client.token,
    client.signOut,
  ]) {
    assert.equal(typeof method, "function");
  }
});
