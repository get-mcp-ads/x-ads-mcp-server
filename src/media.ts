import { webcrypto } from "node:crypto";
import { z } from "zod";
import type { ToolShape } from "./tool-quality.js";
import type { XAdsConfig } from "./tools.js";
import { X_MEDIA_UPLOAD_URL } from "./hosts.js";

type Collector = { tool(name: string, description: string, shape: ToolShape, handler: (args: Record<string, unknown>) => Promise<unknown>): void };
const ok = (data: unknown, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(data) }], ...(isError ? { isError: true } : {}) });
const account = z.string().regex(/^[a-zA-Z0-9]+$/).max(64).describe("X Ads account from X_ADS_ACCOUNT_IDS. Register the resulting media in this account's media library.");
const mediaId = z.string().regex(/^\d{1,19}$/).describe("Numeric media ID returned by this connected user's upload.");
const MAX_BYTES = 4_000_000;
function access(config: XAdsConfig, id: string) {
  if (!config.allowedAccountIds.includes(id)) throw new Error("This X Ads account is not selected.");
  for (const scope of ["ads.read", "ads.write", "media.write"]) if (!config.scope.split(" ").includes(scope)) throw new Error(`Authorize your X user token with ${scope} permission.`);
}
async function request(token: string, path: string, body?: unknown): Promise<Record<string, any>> {
  let response: Response;
  try {
    response = await fetch(`${X_MEDIA_UPLOAD_URL}${path}`, {
      method: body === undefined ? "GET" : "POST", redirect: "manual", signal: AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new Error("X media request did not complete; its outcome is unknown. Inspect the upload before retrying."); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 402 ? "X API credits depleted (HTTP 402). Add developer API credits in console.x.com; advertising budget is separate."
      : `X media returned HTTP ${response.status}. Check authorization and verify the upload outcome before retrying.`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty X media response; verify the upload before retrying.");
  let text = "", length = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length; if (length > 100_000) { await reader.cancel(); throw new Error(); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text.split(token).join("[REDACTED]"));
    if (!data.data || data.errors?.length) throw new Error();
    return data;
  } catch { throw new Error("Invalid or incomplete X media response. Verify the upload before retrying."); }
}
export function registerXMedia(c: Collector, config: XAdsConfig, writes: boolean) {
  if (!writes) {
    const shape = { account_id: account, media_id: mediaId };
    c.tool("x_ads_get_media_upload_status", "Read processing status of an upload owned by the connected X user. Media uploads are user-owned until registered in the selected account's media library.", shape, async raw => {
      const args = z.object(shape).strict().parse(raw); access(config, args.account_id);
      return ok(await request(config.accessToken, `?media_id=${args.media_id}&command=STATUS`));
    });
    return;
  }
  const shape = {
    account_id: account,
    media_base64: z.string().min(4).max(Math.ceil(MAX_BYTES / 3) * 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).describe("File bytes as base64, without a data URL prefix. Maximum 4 MB per file, including MP4 clips. No URL fetching."),
    media_type: z.enum(["image/png", "image/jpeg", "image/gif", "video/mp4"]).describe("MIME type matching the actual uploaded file bytes."),
    confirm: z.boolean().default(false).describe("False previews only; true uploads after human confirmation, potentially charging X developer API credits."),
  };
  c.tool("x_ads_upload_media", "Upload an image, GIF or MP4 clip to X. Preview includes size and SHA-256 only. X API credits may be charged. Images use one request; video/GIF use initialize, append and finalize without retries. Check processing before registering the returned media_key with create_media_library_item. Does not create or activate an ad.", shape, async raw => {
    const args = z.object(shape).strict().parse(raw); access(config, args.account_id);
    const binary = atob(args.media_base64);
    if (binary.length > MAX_BYTES) throw new Error("X MCP upload limit is 4 MB.");
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const signature = args.media_type === "image/png" ? bytes[0] === 137 && binary.slice(1,4) === "PNG"
      : args.media_type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : args.media_type === "image/gif" ? /^GIF8[79]a/.test(binary)
      : binary.slice(4,8) === "ftyp";
    if (!signature) throw new Error("File signature does not match media_type.");
    const sha256 = Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
    const metadata = { account_id: args.account_id, media_type: args.media_type, bytes: bytes.length, sha256 };
    if (!args.confirm) return ok({ applied: false, action: "x_ads_upload_media", ...metadata, mayChargeApiCredits: true });
    const media_category = args.media_type === "video/mp4" ? "tweet_video" : args.media_type === "image/gif" ? "tweet_gif" : "tweet_image";
    let media: Record<string, any> | undefined;
    let phase = "upload";
    try {
      if (media_category === "tweet_image") return ok(await request(config.accessToken, "", { media: args.media_base64, media_category }));
      phase = "initialize";
      media = (await request(config.accessToken, "/initialize", { total_bytes: bytes.length, media_type: args.media_type, media_category })).data;
      const id = mediaId.parse(media?.id);
      phase = "append";
      await request(config.accessToken, `/${id}/append`, { media: args.media_base64, segment_index: 0 });
      phase = "finalize";
      const finalized = await request(config.accessToken, `/${id}/finalize`, {});
      return ok({ ...finalized, data: { ...media, ...finalized.data } });
    } catch (error) {
      return ok({ applied: false, phase, upload: media ? { id: media.id, media_key: media.media_key } : undefined, message: error instanceof Error ? error.message : "X media upload failed.", partialUploadMayExist: true }, true);
    }
  });
}
