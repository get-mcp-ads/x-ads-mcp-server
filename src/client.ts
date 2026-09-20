/** Fixed official MCP endpoint. No user-supplied hosts, tokens in URLs, or automatic write retries. */
export const X_ADS_MCP_URL = "https://ads-api.x.com/mcp";
export type XAdsResult = { content: { type: "text"; text: string }[]; isError?: boolean };
export type XAdsAccount = { id: string; name?: string; currency?: string; timezone?: string };
export class XAdsError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "XAdsError"; }
}

export class XAdsClient {
  constructor(private readonly accessToken: string) {}
  async call(name: string, args: Record<string, unknown>): Promise<XAdsResult> {
    let response: Response;
    try {
      response = await fetch(X_ADS_MCP_URL, {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(25_000),
        headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
    } catch { throw new XAdsError("X Ads request did not complete. For a write, inspect the account before retrying: its outcome is unknown."); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new XAdsError(response.status === 401 ? "X Ads authorization expired or was revoked. Provide a renewed X user access token."
        : response.status === 403 ? "X denied this action. Check Ads Project access and the account's permissions."
        : response.status === 429 ? "X Ads rate limit reached. Wait before retrying."
        : `X Ads returned HTTP ${response.status}. For writes, verify the outcome before retrying.`, response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new XAdsError("Empty X Ads response.");
    let text = "", bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 4_000_000) { await reader.cancel(); throw new XAdsError("X Ads response too large. Narrow the date range or reduce count."); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error instanceof XAdsError) throw error;
      throw new XAdsError("Incomplete X Ads response. For writes, verify the outcome before retrying.");
    }
    let message: { id?: unknown; result?: XAdsResult; error?: unknown } | undefined;
    try {
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        for (const event of text.replace(/\r\n/g, "\n").split("\n\n")) {
          const data = event.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
          if (!data || data === "[DONE]") continue;
          const candidate = JSON.parse(data);
          if (candidate.id === 1) message = candidate;
        }
      } else message = JSON.parse(text);
    } catch { throw new XAdsError("Invalid response from X Ads."); }
    if (message?.id !== 1 || message.error || !Array.isArray(message.result?.content)) throw new XAdsError("X Ads did not return a valid tool result. Verify write outcomes before retrying.");
    // Preserve native reports, pagination, currencies and metric units. Do not relay executable resources.
    const content = message.result.content.filter(c => c.type === "text" && typeof c.text === "string")
      .map(c => ({ type: "text" as const, text: c.text.split(this.accessToken).join("[REDACTED]") }));
    if (!content.length) throw new XAdsError("X Ads returned no readable result.");
    return { content, ...(message.result.isError ? { isError: true } : {}) };
  }
  async accounts(accountIds?: string[]): Promise<XAdsAccount[]> {
    if (accountIds && !accountIds.length) return [];
    if (accountIds && accountIds.length > 200) {
      const result: XAdsAccount[] = [];
      for (let start = 0; start < accountIds.length; start += 200) result.push(...await this.accounts(accountIds.slice(start, start + 200)));
      return result;
    }
    const accounts: XAdsAccount[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 50; page++) {
      const result = await this.call("list_ads_accounts", { count: 1000, ...(accountIds ? { account_ids: accountIds.join(",") } : {}), ...(cursor ? { cursor } : {}) });
      if (result.isError) throw new XAdsError("X could not list your advertising accounts. Check account permissions.");
      let data: { data?: XAdsAccount[]; next_cursor?: string | null };
      try { data = JSON.parse(result.content[0].text); } catch { throw new XAdsError("Invalid X Ads account list."); }
      if (!Array.isArray(data.data) || data.data.some(a => typeof a.id !== "string")) throw new XAdsError("Invalid X Ads account list.");
      accounts.push(...data.data);
      if (!data.next_cursor) return accounts;
      if (seen.has(data.next_cursor)) throw new XAdsError("X Ads repeated a pagination cursor. Retry account discovery later.");
      cursor = data.next_cursor; seen.add(cursor);
    }
    throw new XAdsError("X Ads account discovery exceeded its page limit. Narrow the configured account list.");
  }
}
