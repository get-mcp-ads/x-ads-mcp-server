/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
/**
 * The only endpoints this server sends a request to. The token is attached to
 * these fixed URLs and nothing else: no tool argument can supply a host.
 */
/** X's official Ads MCP endpoint, for every advertising read and write. */
export const X_ADS_MCP_URL = "https://ads-api.x.com/mcp";
/** X API v2 media upload, for x_ads_upload_media and x_ads_get_media_upload_status. */
export const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
