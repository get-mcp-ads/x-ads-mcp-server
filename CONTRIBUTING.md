# Contributing

Use Node.js 22.23.4, 24.22.1, 26.12.1 or a newer release: older ones lack the October 2026 security fixes. CI runs on Node 22, 24 and 26. Run npm ci, npm run typecheck, npm run lint, npm run build and npm test. Tests must use synthetic data and never contact live advertising accounts.

Keep all documentation in English without em dashes. Native writes must default to preview and require explicit confirmation. Preserve account scoping, credential redaction, bounded responses and no automatic retries. Do not add hosted creative galleries or MCP Apps UI.
