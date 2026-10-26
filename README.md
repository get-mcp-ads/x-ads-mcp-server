<div align="center">

# X Ads MCP server

### Bring your X Ads accounts into your MCP client.

Read campaigns and performance, inspect targeting and prepare changes for explicitly selected accounts.

[![Release](https://img.shields.io/github/v/release/get-mcp-ads/x-ads-mcp-server?color=2448e5)](https://github.com/get-mcp-ads/x-ads-mcp-server/releases/latest)
[![CI](https://github.com/get-mcp-ads/x-ads-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/get-mcp-ads/x-ads-mcp-server/actions/workflows/ci.yml)
[![Smithery](https://smithery.ai/badge/getmcpads/getmcpads-x-ads)](https://smithery.ai/servers/getmcpads/getmcpads-x-ads)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-22.23.4%2B%20%7C%2024.22.1%2B%20%7C%2026.12.1%2B-brightgreen.svg)](package.json)

[Watch the film](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4) · [What's new](#whats-new) · [Install](#install-this-release) · [Tool reference](#tools) · [Try hosted getmcpads](https://www.getmcpads.com/tools/x-ads?utm_source=github&utm_medium=readme&utm_campaign=x-ads)

[![Watch the getmcpads film: every ad account in one conversation with your AI assistant](https://www.getmcpads.com/home/film/brand-film-poster-promise.webp)](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4)

**[Play the 45-second film](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4)**

</div>

The film shows hosted getmcpads with sample data. Its MCP Apps, from creative galleries and alerts to Google Sheets exports and bulk launches, belong to the hosted product. This repository provides the standalone native API tools.

**25 read tools** · **21 write tools**, disabled by default.

Run locally with your own platform credentials and a client that supports stdio MCP, such as Claude Desktop, Claude Code or Cursor. Your requests go directly to the platform. For managed connections, including supported ChatGPT setups, use the hosted option.

## What's new

<!-- release-history:start -->
**[v1.1.1: Zod 4 security update](https://github.com/get-mcp-ads/x-ads-mcp-server/releases/tag/v1.1.1) · October 26, 2026**

- Update `zod` to 4.6.7. Every Zod release before 4.6.6 is covered by the high-severity advisory GHSA-mrhx-c7xc-m3w5: validating an oversized constrained collection can exhaust memory, and no Zod 3 release carries the fix. `npm audit --omit=dev` reports no vulnerability again.
- Keep the Zod 3 validation behaviour. A parameter default is still validated and completed before use, so an omitted object must still supply its required fields.
- Keep each parameter's own description when the parameter is optional or has a default. Zod 4 stores a description on the wrapped schema only, so the shared fallback description could otherwise replace it.
- Tool names, parameters and descriptions published over MCP are unchanged. `server-card.json` is regenerated with Zod 4's JSON Schema output, which spells some constraints differently.

**Earlier releases**

| Version | Date | Highlights |
| --- | --- | --- |
| 1.1.0 | October 23, 2026 | Campaign and line item rename |
| 1.0.1 | September 23, 2026 | Public repository restored |
| 1.0.0 | September 20, 2026 | First standalone release |

[Full changelog](CHANGELOG.md) · [All releases](https://github.com/get-mcp-ads/x-ads-mcp-server/releases)
<!-- release-history:end -->

Source synchronization: [SOURCE_SYNC.md](SOURCE_SYNC.md).

### Upgrade notes

Requires **Node.js 22.23.4, 24.22.1, 26.12.1 or a newer release**. These carry the October 2026 security fixes, and the server prints a warning on stderr when it runs on an older one. CI covers Node 22, 24 and 26.

**No breaking change.** Configuration variables and accepted values are unchanged: `X_ADS_ACCOUNT_IDS` stays required and only `true` enables writes, as in 1.0. The rename tools are writes: they appear only with `X_ADS_ENABLE_WRITES=true` and need `ads.write` in `X_ADS_SCOPES`.

Read the current tool schemas before reusing saved arguments. Writes remain optional and require explicit confirmation. Hosted creative integrations and MCP Apps UI are outside this release.

## Install this release

This is a GitHub source release. npm and MCP Registry versions are published separately. The commands below select this exact version.

```bash
git clone --branch v1.1.1 --depth 1 https://github.com/get-mcp-ads/x-ads-mcp-server.git
cd x-ads-mcp-server
npm ci
npm run build
```

Configure your MCP client to run `node` with the absolute path to `dist/cli.js` and the platform credentials documented below.

> **Prefer a managed connection?** [Use X Ads with hosted getmcpads](https://www.getmcpads.com/tools/x-ads?utm_source=github&utm_medium=readme&utm_campaign=x-ads). Connect your account, select the data your assistant may access and use the hosted MCP connection. See the site for current features and plans.

## Configuration

Provide these environment variables through the client's secret configuration:

| Variable | Purpose |
|---|---|
| `X_ADS_ACCESS_TOKEN` | Your user OAuth 2.0 access token. An app-only bearer token is not sufficient. |
| `X_ADS_ACCOUNT_IDS` | Required comma-separated account IDs, restricted to accounts the token may access. |
| `X_ADS_SCOPES` | Scopes actually granted to the token. Defaults to `ads.read`. |
| `X_ADS_ENABLE_WRITES` | Defaults to `false`. Only the exact value `true` exposes writes. |

Obtain your token and Ads Project access using [X's official setup guide](https://docs.x.com/x-ads-api/mcp).
Use `ads.read` for reporting, `ads.write` for campaign changes and `media.write` for uploads and media-library writes.
Setting X_ADS_SCOPES does not grant permissions. This package accepts a token; it does not run an OAuth browser flow or persist rotating refresh tokens. When the token expires, renew it securely and restart the server.

## Safety and coverage

Writes preview by default. Review the exact account, target and parameters before repeating the call with `confirm: true`.
Campaigns and line items are created paused. Activation can spend advertising budget. Media uploads can consume X API credits and are limited to 4 MB.
Do not retry a write automatically when its result is uncertain. Read the account and reconcile it first.
Selected-account checks apply before dispatch and filter account discovery responses. Unknown arguments are rejected.
Native pagination, attribution and monetary `_micro` fields are preserved. A micro unit is one millionth of the account currency.

This server exposes a reviewed subset of the official API. It does not automatically expose new upstream tools.
Native media reads and writes are included. Hosted creative galleries, visual editors and MCP Apps UI are excluded.
Use `tools/list` or [server-card.json](server-card.json) for exact schemas and [the official API reference](https://docs.x.com/x-ads-api/mcp/reference) for provider details.

## Hosted option

[getmcpads for X Ads](https://www.getmcpads.com/tools/x-ads) manages the hosted connection and account selection.
Hosted and source releases can differ. Contact: hello@getmcpads.com.

## Development

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run catalog
```

All tests run offline with synthetic responses. No live account is changed.

## Tools

Every tool is listed below. See [server-card.json](server-card.json) for complete parameter and output schemas.

<details>
<summary><b>25 read tools</b></summary>

| Tool | Purpose |
| --- | --- |
| `x_ads_list_ads_accounts` | List the ads accounts the authenticated user can access |
| `x_ads_list_campaigns` | List campaigns for an account |
| `x_ads_get_campaign` | Get a single campaign by ID |
| `x_ads_list_funding_instruments` | List funding instruments (payment sources) for an ads account |
| `x_ads_list_line_items` | List line items (ad groups) for an ads account |
| `x_ads_get_line_item` | Get a single line item by ID |
| `x_ads_list_promoted_posts` | List promoted posts (promoted tweets) for an ads account |
| `x_ads_list_targeting_criteria` | List targeting criteria for an ads account's line items |
| `x_ads_list_account_posts` | List posts (tweets) usable for promotion by an ads account |
| `x_ads_list_web_event_tags` | List the website conversion event tags (pixels) in an ads account; a tag's id is what a conversion line item takes as its primary_web_event_tag |
| `x_ads_list_line_item_placements` | List valid placement combinations per line item product type |
| `x_ads_get_account_stats` | Get synchronous analytics (impressions, engagements, spend) for an ads account |
| `x_ads_get_active_entities` | List which ads entities had metrics change in a time window (use before requesting account stats) |
| `x_ads_get_campaign_reach` | Get reach and average-frequency metrics for campaigns |
| `x_ads_search_targeting_interests` | Search targetable interest categories by name. |
| `x_ads_search_targeting_locations` | Search targetable locations by name. |
| `x_ads_list_cards` | List the cards in an ads account |
| `x_ads_get_card` | Get a single card by ID |
| `x_ads_list_media_library` | List the media library objects in an ads account |
| `x_ads_get_media_library_item` | Get a single media library object by media key |
| `x_ads_get_promoted_post` | Get a single promoted post by ID |
| `x_ads_get_targeting_criterion` | Get a single targeting criterion by ID |
| `x_ads_list_post_previews` | Get rendered HTML previews for published or scheduled posts |
| `x_ads_get_web_event_tag` | Get a single website conversion event tag by ID |
| `x_ads_get_media_upload_status` | Read processing status of an upload owned by the connected X user. |

</details>

<details>
<summary><b>21 write tools</b></summary>

Disabled by default. Calls preview unless explicitly confirmed. Check the configuration and exact schema before use.

| Tool | Purpose |
| --- | --- |
| `x_ads_create_campaign` | Create a campaign in an ads account. |
| `x_ads_update_campaign` | Rename a campaign or pause it (entity_status=PAUSED). |
| `x_ads_activate_campaign` | Activate a campaign (set entity_status=ACTIVE). |
| `x_ads_create_line_item` | Create a line item (ad group) under a campaign. |
| `x_ads_update_line_item` | Update a line item's bid, budget, name, schedule, placements, goal, pacing, audience expansion (set audience_expansion=EXPANDED to turn on Optimized Targeting) or entity_status. |
| `x_ads_activate_line_item` | Activate a line item (set entity_status=ACTIVE). |
| `x_ads_promote_post` | Attach post(s) to a line item as its ad creative(s). |
| `x_ads_add_targeting_criterion` | Add one targeting criterion to a line item (call once per criterion). |
| `x_ads_remove_targeting` | Remove a targeting criterion from its line item (undo a targeting mistake). |
| `x_ads_create_ad_post` | Compose a promoted-only ("nullcasted") post to use as an ad creative. |
| `x_ads_create_card` | Create a card from a JSON components payload. |
| `x_ads_delete_card` | Delete a card from an ads account. |
| `x_ads_create_media_library_item` | Register an existing media key as a named item in the account's media library. |
| `x_ads_delete_media_library_item` | Delete a media library object from an ads account Preview by default. |
| `x_ads_update_media_library_item` | Update a media library object's metadata (e.g. name, title, description) Preview by default. |
| `x_ads_create_web_event_tag` | Create a website conversion event tag (pixel); the returned id can be set as a line item's primary_web_event_tag Preview by default. |
| `x_ads_delete_web_event_tag` | Delete a website conversion event tag Preview by default. |
| `x_ads_update_web_event_tag` | Update a website conversion event tag Preview by default. |
| `x_ads_upload_media` | Upload an image, GIF or MP4 clip to X. |
| `x_ads_rename_campaign` | Rename an X Ads campaign. The name is the only thing that changes. |
| `x_ads_rename_line_item` | Rename an X Ads line item (ad group). The name is the only thing that changes. |

</details>

<details>
<summary><b>1 resource</b></summary>

| URI | Contents |
| --- | --- |
| `x-ads://guide` | Account scoping, units, write workflow and media limits for this server |

</details>

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

## More from getmcpads

[Meta Ads](https://github.com/get-mcp-ads/meta-ads-mcp-server) · [Google Ads](https://github.com/get-mcp-ads/google-ads-mcp-server) · [Google Analytics 4](https://github.com/get-mcp-ads/google-analytics-mcp-server) · [Google Search Console](https://github.com/get-mcp-ads/google-search-console-mcp-server) · [TikTok Ads](https://github.com/get-mcp-ads/tiktok-ads-mcp-server) · [Pinterest Ads](https://github.com/get-mcp-ads/pinterest-ads-mcp-server)

Maintained by **Emmanuel** at [getmcpads](https://www.getmcpads.com). Questions: [hello@getmcpads.com](mailto:hello@getmcpads.com).
