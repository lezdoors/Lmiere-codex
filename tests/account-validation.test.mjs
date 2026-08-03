import assert from "node:assert/strict";
import test from "node:test";

import { isFullName, normalizeFullName } from "../src/account-validation.js";

test("signup requires a first and last name", () => {
  assert.equal(isFullName("Ryan"), false);
  assert.equal(isFullName("Ryan Aoufal"), true);
  assert.equal(isFullName("  Hossam   Haddaoui  "), true);
  assert.equal(isFullName("Jean-Pierre O'Connor"), true);
});

test("full names are normalized before account creation", () => {
  assert.equal(normalizeFullName("  Ryan   Aoufal  "), "Ryan Aoufal");
});
