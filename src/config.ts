import { z } from "zod";
const schema = z.object({
  accessToken: z.string().min(1, "X_ADS_ACCESS_TOKEN is required"),
  allowedAccountIds: z.array(z.string().regex(/^[A-Za-z0-9]{1,64}$/)).min(1).max(200),
  scope: z.string().refine(s => s.split(" ").includes("ads.read"), "X_ADS_SCOPES must include ads.read"),
  enableWrites: z.boolean().default(false),
});
export type XConfig = z.infer<typeof schema>;
export function validateConfig(value: unknown): XConfig {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Configure a nonempty X_ADS_ACCESS_TOKEN, 1-200 alphanumeric X_ADS_ACCOUNT_IDS and X_ADS_SCOPES including ads.read.");
  return {...result.data, allowedAccountIds: [...new Set(result.data.allowedAccountIds)]};
}
export function loadConfig(): XConfig {
  const flag = process.env.X_ADS_ENABLE_WRITES ?? "false";
  if (!["true", "false"].includes(flag)) throw new Error("X_ADS_ENABLE_WRITES must be true or false.");
  return validateConfig({ accessToken: process.env.X_ADS_ACCESS_TOKEN ?? "", allowedAccountIds: (process.env.X_ADS_ACCOUNT_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean), scope: process.env.X_ADS_SCOPES ?? "ads.read", enableWrites: flag === "true" });
}
