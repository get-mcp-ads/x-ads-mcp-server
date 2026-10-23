# Changelog

## 1.1.0 - 2026-10-23

- Add `x_ads_rename_campaign` and `x_ads_rename_line_item`. Each previews by default, checks the account allowlist and the `ads.write` scope, then sends only `account_id`, the entity ID and `name` to X's `update_campaign` or `update_line_item`.
- Declare both X endpoints in `src/hosts.ts`. New tests fail on a fetch without redirect handling or a timeout, and on any other host in `src/`.
- Add `test/readme-accuracy.test.mjs`: every tool and the `x-ads://guide` resource are cited in the README, nothing else is, the counts match the code, and published prose has no em dash.
- Update `@modelcontextprotocol/sdk` to 1.32.1 and regenerate `package-lock.json`. Require Node.js 22.23.4, 24.22.1, 26.12.1 or newer, and warn on stderr at startup on an older release. CI covers Node 22, 24 and 26.
- Publish from a version tag with the new `release.yml`: npm with provenance, the GitHub release, then the MCP Registry. Dependabot now proposes weekly npm and monthly GitHub Actions updates.

## 1.0.1 - 2026-09-23

- Restore public source hosting under the get-mcp-ads GitHub organization.
- Update repository and support links while preserving npm package and MCP registry names.
- No changes to platform tools or credential requirements.

## 1.0.0 - 2026-09-20

- Create the first runnable standalone server using the reviewed native tool subset.
- Require explicit account IDs, default to read-only, preview writes and preserve native pagination.
- Use fixed X endpoints, bounded responses, timeouts and credential redaction without automatic write retries.
- Require Node.js 22.12 or newer and check Node 22/24 in CI.
- Update vulnerable dependencies and regenerate the MCP catalog.
- No hosted creative UI or MCP Apps integrations.
