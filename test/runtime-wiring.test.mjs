/**
 * The runtime check only protects users if the CLI runs it, and only on
 * stderr: stdout carries the MCP protocol, so a stray line there breaks every
 * client.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the CLI writes the runtime warning to stderr, never to stdout", () => {
  const cli = readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8");
  assert.match(cli, /import \{ nodeRuntimeWarning \} from "\.\/runtime-check\.js";/);
  assert.match(cli, /nodeRuntimeWarning\(\)/);
  assert.match(cli, /process\.stderr\.write\(/);
  assert.doesNotMatch(cli, /console\.log|process\.stdout/);
});
