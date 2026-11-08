#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
import { nodeRuntimeWarning } from "./runtime-check.js";
// stdout carries the MCP protocol, so the runtime warning goes to stderr.
const runtimeWarning = nodeRuntimeWarning();
if (runtimeWarning) process.stderr.write(`${runtimeWarning}\n`);
try { await createServer(loadConfig()).connect(new StdioServerTransport()); }
catch (error) { console.error(error instanceof Error ? error.message : "X Ads server failed to start."); process.exitCode = 1; }
