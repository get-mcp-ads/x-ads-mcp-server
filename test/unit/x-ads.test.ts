import { afterEach, describe, expect, it, vi } from "vitest";
import { XAdsClient } from "../../src/client.js";
import { collect } from "./catalogue";
import specs from "../../src/specs.json";
const config = { accessToken: "private-test-token", allowedAccountIds: ["abc123"], scope: "ads.read ads.write media.write offline.access" };
const tool = (name: string) => collect("x_ads", config).find(t => t.name === `x_ads_${name}`)!;
const data = (result: any) => JSON.parse(result.content[0].text);
const reply = (value: unknown, isError = false) => new Response(`event: message\r\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(value) }], isError } })}\r\n\r\n`, { headers: { "content-type": "text/event-stream" } });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("X Ads official MCP adapter", () => {
  it("preserves native reports and pagination across SSE frames", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ data: [{ spend_local_micro: 1230000 }], next_cursor: "next" })); vi.stubGlobal("fetch", fetcher);
    expect(data(await new XAdsClient(config.accessToken).call("list_campaigns", { account_id: "abc123" }))).toEqual({ data: [{ spend_local_micro: 1230000 }], next_cursor: "next" });
    expect(fetcher.mock.calls[0][0]).toBe("https://ads-api.x.com/mcp");
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
  });
  it("lists only selected accounts, including after a provider returns extra accounts", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ data: [{ id: "abc123", name: "Allowed" }, { id: "foreign", name: "Private" }], next_cursor: null })); vi.stubGlobal("fetch", fetcher);
    const result = data(await tool("list_ads_accounts").handler({}));
    expect(result.data).toEqual([{ id: "abc123", name: "Allowed" }]);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).params.arguments.account_ids).toBe("abc123");
    expect(JSON.stringify(result)).not.toContain("Private");
  });
  it("completes paginated account discovery and rejects repeated cursors", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ data: [{ id: "a" }], next_cursor: "next" })).mockResolvedValueOnce(reply({ data: [{ id: "b" }], next_cursor: null })); vi.stubGlobal("fetch", fetcher);
    expect(await new XAdsClient(config.accessToken).accounts()).toEqual([{ id: "a" }, { id: "b" }]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).params.arguments.cursor).toBe("next");
    fetcher.mockImplementation(async () => reply({ data: [], next_cursor: "repeated" }));
    await expect(new XAdsClient(config.accessToken).accounts()).rejects.toThrow("repeated");
  });
  it("rejects foreign accounts and unknown arguments before HTTP", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(tool("list_campaigns").handler({ account_id: "other" })).rejects.toThrow("not selected");
    await expect(tool("list_ads_accounts").handler({ account_ids: "abc123,other" })).rejects.toThrow("selected");
    await expect(tool("create_campaign").handler({ account_id: "abc123", funding_instrument_id: "fund", name: "Test", entity_status: "ACTIVE" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  for (const spec of specs.filter(s => s.write)) it(`previews ${spec.name} without an upstream mutation`, async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const args = Object.fromEntries((spec.inputSchema.required ?? []).map(key => {
      const field = (spec.inputSchema.properties as any)[key];
      return [key, key === "account_id" ? "abc123" : field.enum?.[0] ?? (field.type === "integer" ? 1 : field.type === "boolean" ? false : "test")];
    }));
    if (spec.name === "create_card") Object.assign(args, { name: "Card", components: [{type:"MEDIA", media_key:"3_123"},{type:"DETAILS", title:"Site", destination:{type:"WEBSITE",url:"https://example.com"}}] });
    if (spec.name === "create_media_library_item") args.media_key="3_123";
    expect(data(await tool(spec.name).handler(args))).toMatchObject({ applied: false, action: `x_ads_${spec.name}` });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("applies an approved write once and removes gateway-only confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ data: { id: "c1", entity_status: "PAUSED" } })); vi.stubGlobal("fetch", fetcher);
    await tool("update_campaign").handler({ account_id: "abc123", campaign_id: "c1", entity_status: "PAUSED", confirm: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).params).toEqual({ name: "update_campaign", arguments: { account_id: "abc123", campaign_id: "c1", entity_status: "PAUSED" } });
  });
  it("never retries uncertain writes or leaks provider error bodies", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error(config.accessToken)); vi.stubGlobal("fetch", fetcher);
    await expect(tool("activate_campaign").handler({ account_id: "abc123", campaign_id: "c1", confirm: true })).rejects.toThrow("outcome is unknown");
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response(config.accessToken, { status: 403 }));
    await expect(new XAdsClient(config.accessToken).call("list_campaigns", {})).rejects.not.toThrow(config.accessToken);
  });
});
describe("X Ads rename tools", () => {
  const levels = [["campaign", "campaign_id", "update_campaign"], ["line_item", "line_item_id", "update_line_item"]] as const;
  for (const [level, param, update] of levels) {
    it(`previews x_ads_rename_${level} locally, then sends only the name to ${update}`, async () => {
      const fetcher = vi.fn().mockResolvedValue(reply({ data: { id: "e1", name: "Spring sale" } })); vi.stubGlobal("fetch", fetcher);
      const rename = tool(`rename_${level}`);
      expect(rename.write).toBe(true);
      const preview = data(await rename.handler({ account_id: "abc123", [param]: "e1", name: "Spring sale" }));
      expect(preview).toMatchObject({ applied: false, action: `x_ads_rename_${level}`, account_id: "abc123", change: { target: "e1", newName: "Spring sale" }, activationMaySpend: false });
      expect(fetcher).not.toHaveBeenCalled();
      await rename.handler({ account_id: "abc123", [param]: "e1", name: "Spring sale", confirm: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetcher.mock.calls[0][1].body).params).toEqual({ name: update, arguments: { account_id: "abc123", [param]: "e1", name: "Spring sale" } });
    });
  }
  it("refuses foreign accounts, missing write scope, extra fields and oversized names before HTTP", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(tool("rename_campaign").handler({ account_id: "other", campaign_id: "c1", name: "New", confirm: true })).rejects.toThrow("not selected");
    const readOnly = collect("x_ads", { ...config, scope: "ads.read" }).find(t => t.name === "x_ads_rename_campaign")!;
    await expect(readOnly.handler({ account_id: "abc123", campaign_id: "c1", name: "New" })).rejects.toThrow("ads.write");
    await expect(tool("rename_campaign").handler({ account_id: "abc123", campaign_id: "c1", name: "New", entity_status: "PAUSED" })).rejects.toThrow();
    await expect(tool("rename_line_item").handler({ account_id: "abc123", line_item_id: "l1", name: "x".repeat(256) })).rejects.toThrow();
    await expect(tool("rename_line_item").handler({ account_id: "abc123", line_item_id: "../l1", name: "New" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not retry a rename whose outcome is unknown", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("socket hang up")); vi.stubGlobal("fetch", fetcher);
    await expect(tool("rename_campaign").handler({ account_id: "abc123", campaign_id: "c1", name: "New", confirm: true })).rejects.toThrow("outcome is unknown");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
describe("X Ads provider error mapping", () => {
  it.each([
    [401, "authorization expired"],
    [403, "denied this action"],
    [429, "rate limit"],
    [500, "verify the outcome"],
  ])("maps HTTP %i to an actionable message without the provider body", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`echo ${config.accessToken}`, { status })));
    const error = await new XAdsClient(config.accessToken).call("list_campaigns", { account_id: "abc123" }).catch(e => e);
    expect(error.message).toContain(message);
    expect(error.message).not.toContain(config.accessToken);
    expect(error.status).toBe(status);
  });
  it("refuses a redirect instead of following it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://example.com/?token=leak" } })));
    const error = await new XAdsClient(config.accessToken).call("list_campaigns", { account_id: "abc123" }).catch(e => e);
    expect(error.message).toContain("HTTP 302");
    expect(error.message).not.toMatch(/example\.com|leak/);
  });
  it("redacts the token from a tool result and keeps the provider error flag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ errors: [{ message: `bad ${config.accessToken}` }] }, true)));
    const result = await new XAdsClient(config.accessToken).call("list_campaigns", { account_id: "abc123" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain(config.accessToken);
  });
});
