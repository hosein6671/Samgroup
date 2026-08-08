export type AppConfig = {
  nodeEnv: string;
  apiPort: number;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Validated by validateEnv before this runs, so no fallback is needed.
  apiPort: Number(process.env.API_PORT),
});
