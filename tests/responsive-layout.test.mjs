import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("mobile landing artwork stays out of the document flow", () => {
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*?\.signal-image\.landing-machine\s*\{[^}]*position:\s*absolute;/,
  );
});

test("mobile outcome cards cannot widen the page in translated languages", () => {
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*?\.landing-outcome-card\s*\{[^}]*min-width:\s*0;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*?\.landing-outcome-card h3\s*\{[^}]*overflow-wrap:\s*anywhere;/,
  );
});
