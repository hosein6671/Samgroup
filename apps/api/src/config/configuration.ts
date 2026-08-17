export type AppConfig = {
  nodeEnv: string;
  apiPort: number;
  databaseUrl: string;
  /**
   * Where Payload answers, on the internal network — ADR-003's server-to-server hop, and the only
   * place in the platform that knows Payload has an address at all.
   *
   * **Optional, deliberately.** Unlike `databaseUrl` this does not gate startup: every endpoint
   * outside the Content module works without a CMS, and making the whole API refuse to boot because
   * one module's upstream is unconfigured would take the catalog, blog and forms down with it. The
   * Content module reports the absence as UPSTREAM_UNAVAILABLE and logs it, which is the honest
   * description — from a caller's position an unconfigured CMS and a stopped one are the same
   * condition.
   *
   * Empty string when unset, so the module has one falsy check rather than two.
   */
  payloadInternalUrl: string;
  /** The Payload service account's API key. Optional for the same reason as the URL above. */
  payloadApiKey: string;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Validated by validateEnv before this runs, so no fallback is needed.
  apiPort: Number(process.env.API_PORT),
  databaseUrl: process.env.DATABASE_URL ?? "",
  payloadInternalUrl: process.env.PAYLOAD_INTERNAL_URL?.trim() ?? "",
  payloadApiKey: process.env.PAYLOAD_API_KEY?.trim() ?? "",
});
