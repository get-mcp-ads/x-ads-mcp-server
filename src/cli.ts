#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
try { await createServer(loadConfig()).connect(new StdioServerTransport()); }
catch (error) { console.error(error instanceof Error ? error.message : "X Ads server failed to start."); process.exitCode = 1; }
