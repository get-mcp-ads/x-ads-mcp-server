/**
 * Every outbound call carries the X user access token. Following a redirect
 * would forward it to whatever host the redirect names, so no fetch in this
 * codebase may follow one: it either sets `redirect: "error"`, or sets
 * `redirect: "manual"` and refuses any answer outside 2xx before reading it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

function sourceFiles(dir = "src", acc = []) {
  for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    if (entry.isDirectory()) sourceFiles(`${dir}/${entry.name}`, acc);
    else if (entry.name.endsWith(".ts")) acc.push(`${dir}/${entry.name}`);
  }
  return acc;
}

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

function fetchCalls() {
  const calls = [];
  for (const file of sourceFiles()) {
    const text = read(file);
    for (const match of text.matchAll(/\bfetch\(/g)) {
      // The options object of a fetch call ends at the first `});` that follows.
      const tail = text.slice(match.index, match.index + 1200);
      const end = tail.indexOf("});");
      const call = end === -1 ? tail : tail.slice(0, end);
      calls.push({
        where: `${file}:${text.slice(0, match.index).split("\n").length}`,
        call,
        after: text.slice(match.index + call.length, match.index + call.length + 400),
      });
    }
  }
  return calls;
}

test("every fetch refuses to follow redirects", () => {
  const calls = fetchCalls();
  assert.ok(calls.length > 0, "no fetch call found: the scan itself is broken");
  const offenders = calls
    .filter(({ call, after }) => !/redirect:\s*"error"/.test(call) && !(/redirect:\s*"manual"/.test(call) && /if \(!response\.ok\)/.test(after)))
    .map(({ where }) => where);
  assert.deepEqual(offenders, [], `These fetch calls may follow a redirect and leak credentials: ${offenders.join(", ")}`);
});

test("every fetch sets a timeout", () => {
  const offenders = fetchCalls().filter(({ call }) => !/signal:\s*AbortSignal\.timeout\(/.test(call)).map(({ where }) => where);
  assert.deepEqual(offenders, [], `These fetch calls have no timeout: ${offenders.join(", ")}`);
});

test("the only hosts this server can reach are X's, listed in one place", () => {
  const hosts = new Set();
  const endpoints = [];
  for (const file of sourceFiles()) {
    const text = read(file);
    for (const match of text.matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
      const host = match[1].replace(/\.$/, "");
      // Product links in server metadata and the setup link in the guide are not call targets.
      if (host === "mcp.getmcpads.com" || host === "www.getmcpads.com" || host === "docs.x.com") continue;
      hosts.add(host);
      endpoints.push(file);
    }
  }
  assert.deepEqual(
    [...hosts].sort(),
    ["ads-api.x.com", "api.x.com"],
    "A new outbound host appeared. That is a deliberate decision, not an accident.",
  );
  assert.deepEqual([...new Set(endpoints)], ["src/hosts.ts"], "API endpoints must be declared only in src/hosts.ts");
});
