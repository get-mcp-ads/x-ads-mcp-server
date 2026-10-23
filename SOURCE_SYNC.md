# Source synchronization

Reviewed on 2026-10-23 against getmcpads source revision `3e1c2c8`. The previous review used revision `41cc1ca`.

## Synchronized

- `958ba80` (2026-10-21), dedicated rename tools: adds `x_ads_rename_campaign` and `x_ads_rename_line_item`. They call X's `update_campaign` and `update_line_item` with the name alone, so a rename cannot pause, move or re-budget anything. The standalone version keeps this repository's preview contract (`applied: false`, `action`, `account_id`, `parameters`) and adds the gateway's `change` object.

## Not synchronized

- `1b2ad2f` (2026-09-21) and `94291d9` (2026-09-22) add `alert-catalog.ts` for hosted X Ads monitoring.
- `568b912` (2026-09-22) adds `catalog.ts`, the reporting catalog behind hosted Google Sheets exports.
- The specs, the media module and the X Ads MCP client are unchanged since the previous review, apart from hosted wording. The gateway's in-memory token refresh stays out: X rotates refresh tokens, and this server accepts an access token without persisting anything.
- X documents `PUT accounts/:account_id`, but the official X Ads MCP this server calls does not expose it, so there is no account rename. Promoted posts have no name to change.

The public server remains self-contained. Hosted billing, quotas and plans, workspaces, stored account selection, token storage, creative galleries, the Launcher, alerts, Google Sheets exports, client memory, telemetry, MCP Apps UI and the discovery meta-tools (`get_capabilities`, `describe_tool`, `run_tool`) stay hosted-only. Existing standalone protections and public features newer than the hosted source are retained.

Validation uses synthetic data. No live advertising write is required by the test suite. The generated server-card.json is the source of truth for this revision's tool schemas.

Maintainer: Emmanuel, getmcpads. Contact: hello@getmcpads.com.
