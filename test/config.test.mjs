import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.ts";
test("invalid or empty configuration cannot enable unscoped access or reveal its token", () => {
  for (const value of [{},{accessToken:"private-token",allowedAccountIds:[],scope:"ads.read"},{accessToken:"private-token",allowedAccountIds:["../other"],scope:"ads.read"}]) assert.throws(()=>validateConfig(value), e=>!e.message.includes("private-token"));
  const config=validateConfig({accessToken:"fixture",allowedAccountIds:["abc123"],scope:"ads.read"});assert.equal(config.enableWrites,false);
});
