import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { installToolQuality } from "./tool-quality.js";
import { registerXAdsReads, registerXAdsWrites } from "./tools.js";
import { validateConfig, type XConfig } from "./config.js";
export const PACKAGE_VERSION = "1.0.1";
export function createServer(input: XConfig): McpServer {
  const config = validateConfig(input);
  const server = new McpServer({name:"x-ads-mcp",version:PACKAGE_VERSION,title:"X Ads",websiteUrl:"https://www.getmcpads.com/tools/x-ads",icons:[{src:"https://mcp.getmcpads.com/icon.svg",mimeType:"image/svg+xml"}]});
  installToolQuality(server);
  registerXAdsReads(server as never, config);
  if (config.enableWrites) registerXAdsWrites(server as never, config);
  return server;
}
