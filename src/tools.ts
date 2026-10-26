import { z } from "zod";
import { XAdsClient } from "./client.js";
import specs from "./specs.json";
import type { ToolShape } from "./tool-quality.js";
import { registerXMedia } from "./media.js";
export const DEFERRED_X_ADS_WRITES = new Set([...specs.filter(s => s.write).map(s => `x_ads_${s.name}`), "x_ads_upload_media"]);
export type XAdsConfig = { accessToken: string; allowedAccountIds: string[]; scope: string };
type Collector = { tool(name: string, description: string, shape: ToolShape, handler: (args: Record<string, unknown>) => Promise<unknown>): void; resource?(name: string, uri: string, read: () => Promise<unknown>): void };
type Field = { type: string; description?: string; enum?: string[] };
const mediaKey = z.string().regex(/^\d+_\d+$/);
const destination = z.object({ type: z.literal("WEBSITE"), url: z.string().url().max(2048).refine(v => /^https?:\/\//.test(v)) }).strict();
const components = z.tuple([
  z.union([z.object({ type: z.literal("MEDIA"), media_key: mediaKey }).strict(), z.object({ type: z.literal("SWIPEABLE_MEDIA"), media_keys: z.array(mediaKey).min(2).max(6) }).strict()]),
  z.object({ type: z.literal("DETAILS"), title: z.string().min(1).max(70), destination }).strict(),
]);
const ok = (data: unknown) => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
function shapeFor(spec: typeof specs[number]): ToolShape {
  const required = new Set<string>(spec.inputSchema.required ?? []);
  return Object.fromEntries(Object.entries(spec.inputSchema.properties).map(([key, raw]) => {
    const field = raw as Field;
    let schema: z.ZodTypeAny;
    if (key === "components") schema = components.describe("Website card: MEDIA or SWIPEABLE_MEDIA followed by DETAILS with title and WEBSITE destination. App/lead cards are not yet supported.");
    else if (field.enum?.length) schema = z.enum(field.enum as [string, ...string[]]);
    else if (field.type === "string") schema = z.string().max(100_000);
    else if (field.type === "integer") schema = z.number().int().safe();
    else if (field.type === "boolean") schema = z.boolean();
    else throw new Error(`Unsupported reviewed X schema: ${key}`);
    if (key === "account_id") schema = z.string().regex(/^[a-zA-Z0-9]+$/).max(64);
    if (key === "count") schema = z.number().int().min(1).max(spec.name === "list_media_library" ? 50 : spec.name === "list_cards" ? 200 : 1000);
    if (key.endsWith("_local_micro")) schema = z.number().int().safe().nonnegative();
    const description = field.description ?? ({
      account_id: "X Ads account ID from X_ADS_ACCOUNT_IDS.",
      campaign_id: "Campaign ID belonging to the selected X Ads account.",
      line_item_id: "Line item ID belonging to the selected X Ads account.",
      targeting_criterion_id: "Targeting criterion ID belonging to the selected X Ads account.",
      card_id: "Card ID belonging to the selected X Ads account.",
      promoted_tweet_id: "Promoted post association ID belonging to the selected X Ads account.",
      media_key: "Uploaded media key registered in the selected account's media library.",
      web_event_tag_id: "Website conversion event ID belonging to the selected X Ads account.",
    } as Record<string, string>)[key];
    if (description) schema = schema.describe(description);
    if (spec.name === "create_card" && ["name", "components"].includes(key)) required.add(key);
    if (spec.name === "create_media_library_item" && key === "media_key") required.add(key);
    if (spec.name === "create_line_item" && key === "bid_strategy") schema = schema.prefault("AUTO");
    else if (!required.has(key)) schema = schema.optional();
    return [key, schema];
  }));
}
function register(c: Collector, config: XAdsConfig, writes: boolean) {
  const api = new XAdsClient(config.accessToken);
  for (const spec of specs.filter(s => s.write === writes)) {
    const name = `x_ads_${spec.name}`;
    const shape: ToolShape = spec.name === "list_ads_accounts" ? { account_ids: z.string().optional().describe("Optional comma-separated IDs, restricted to selected accounts. Returns all selected accounts when omitted.") } : shapeFor(spec);
    if (writes) shape.confirm = z.boolean().prefault(false).describe("False previews only; true applies this exact change after explicit human confirmation.");
    const schema = z.object(shape).strict();
    c.tool(name, spec.description + (writes ? " Preview by default. Ask the user to approve the exact account, target and parameters before confirm:true." : " Native X fields and pagination are preserved; monetary fields ending in _micro are millionths of the account currency."), shape, async raw => {
      const { confirm, ...args } = schema.parse(raw);
      if (spec.name === "create_line_item" && args.product_type === undefined && args.objective === "FOLLOWERS") args.product_type = "PROMOTED_ACCOUNT";
      if (!config.allowedAccountIds?.length) throw new Error("Configure X_ADS_ACCOUNT_IDS first.");
      if (args.account_id !== undefined && !config.allowedAccountIds.includes(String(args.account_id))) throw new Error("This X Ads account is not selected.");
      if (!config.scope?.split(" ").includes("ads.read")) throw new Error("Authorize your X user token with ads.read permission.");
      if (spec.name === "list_ads_accounts") {
        const requested = typeof args.account_ids === "string" ? args.account_ids.split(",").map(s => s.trim()) : config.allowedAccountIds;
        if (!requested.length || requested.some(id => !config.allowedAccountIds.includes(id))) throw new Error("Only selected X Ads accounts can be listed.");
        // Filter the response too: request metadata and totals must never disclose other accounts.
        const rows = (await api.accounts(requested)).filter(a => requested.includes(a.id));
        return ok({ data: rows, next_cursor: null, selected_accounts_only: true });
      }
      if (writes) {
        if (["create_media_library_item"].includes(spec.name) && !config.scope.split(" ").includes("media.write")) throw new Error("Authorize your X user token with media.write permission.");
        if (!config.scope.split(" ").includes("ads.write")) throw new Error("Authorize your X user token with ads.write permission.");
        if (!confirm) return ok({ applied: false, action: name, account_id: args.account_id, parameters: args, activationMaySpend: spec.name.startsWith("activate_"), message: "Preview only. Ask the user to confirm these exact parameters; repeat with confirm:true to apply. Budgets are in micros of the account currency. New campaigns and line items are created paused." });
      }
      return api.call(spec.name, args);
    });
  }
}
export function registerXAdsReads(c: Collector, config: XAdsConfig) {
  register(c, config, false);
  registerXMedia(c, config, false);
  c.resource?.("X Ads guide", "x-ads://guide", async () => ({contents:[{uri:"x-ads://guide",mimeType:"text/plain",text:"Only explicitly configured X Ads accounts are exposed. Use tools/list for the complete local catalog. Reads preserve native pagination, attribution and currency units. Monetary _micro fields are millionths of account currency. Writes are disabled by default; after enabling them, preview and obtain approval before confirm:true. Campaigns and line items start paused; activation can spend money. Reconcile uncertain outcomes before retrying. Native media uploads require media.write and may use X developer API credits. Media files are limited to 4 MB. This server has no hosted creative gallery or MCP Apps UI. OAuth setup: https://docs.x.com/x-ads-api/mcp ."}]}));
}
export function registerXAdsWrites(c: Collector, config: XAdsConfig) { register(c, config, true); registerXMedia(c, config, true); registerXRenames(c, config); }

/**
 * Name-only calls to X's own update tools, so a rename can never pause, move or
 * re-budget anything. Ported from the getmcpads gateway; same preview and
 * confirm contract as the other writes.
 */
function registerXRenames(c: Collector, config: XAdsConfig) {
  const api = new XAdsClient(config.accessToken);
  for (const [level, param, update] of [["campaign", "campaign_id", "update_campaign"], ["line_item", "line_item_id", "update_line_item"]] as const) {
    const name = `x_ads_rename_${level}`;
    const label = level === "campaign" ? "campaign" : "line item (ad group)";
    const shape: ToolShape = {
      account_id: z.string().regex(/^[a-zA-Z0-9]+$/).max(64).describe("X Ads account ID from X_ADS_ACCOUNT_IDS."),
      [param]: z.string().regex(/^[a-zA-Z0-9]+$/).max(64).describe(`${level === "campaign" ? "Campaign" : "Line item (ad group)"} ID belonging to the selected X Ads account.`),
      name: z.string().min(1).max(255).describe("New name, 1 to 255 characters. This is the only thing the call changes."),
      confirm: z.boolean().prefault(false).describe("False previews only; true applies this exact rename after explicit human confirmation."),
    };
    const schema = z.object(shape).strict();
    c.tool(name, `Rename an X Ads ${label}. The name is the only thing that changes: status, budget, schedule and targeting are untouched. Preview by default. Ask the user to approve the exact account, target and new name before confirm:true.`, shape, async raw => {
      const a = schema.parse(raw) as { account_id: string; name: string; confirm: boolean } & Record<string, unknown>;
      if (!config.allowedAccountIds?.length) throw new Error("Configure X_ADS_ACCOUNT_IDS first.");
      if (!config.allowedAccountIds.includes(a.account_id)) throw new Error("This X Ads account is not selected.");
      for (const scope of ["ads.read", "ads.write"]) if (!config.scope?.split(" ").includes(scope)) throw new Error(`Authorize your X user token with ${scope} permission.`);
      const target = String(a[param]);
      if (!a.confirm) return ok({ applied: false, action: name, account_id: a.account_id, parameters: { [param]: target, name: a.name }, change: { target, newName: a.name }, activationMaySpend: false, message: "Preview only, nothing was changed. Ask the user to confirm this exact rename; repeat with confirm:true to apply it." });
      return api.call(update, { account_id: a.account_id, [param]: target, name: a.name });
    });
  }
}
