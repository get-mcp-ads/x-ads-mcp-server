# Source synchronization

Reviewed on 2026-09-20 against getmcpads source revision `41cc1ca`.

- Create the first runnable standalone server using the reviewed native tool subset.
- Require explicit account IDs, default to read-only, preview writes and preserve native pagination.
- Use fixed X endpoints, bounded responses, timeouts and credential redaction without automatic write retries.

The public server remains self-contained. Hosted billing, workspaces, account-selection storage, creative galleries, Launcher files and MCP Apps UI are outside this synchronization. Existing standalone protections and public features newer than the hosted source are retained.

Validation uses synthetic data. No live advertising write is required by the test suite. The generated server-card.json is the source of truth for this revision's tool schemas.

Maintainer: Emmanuel, getmcpads. Contact: hello@getmcpads.com.
