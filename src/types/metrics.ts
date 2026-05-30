export type ProviderStatus = "ok" | "warning" | "error" | "unknown";

export type DeepSeekMetric = {
  provider: "deepseek";
  status: ProviderStatus;
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
  updatedAt: string;
};

export type OpenCodeGoMetric = {
  provider: "opencode_go";
  status: ProviderStatus;
  fiveHourUsage: number | null;
  fiveHourResetIn: string | null;
  fiveHourResetAt: string | null;
  weeklyUsage: number | null;
  weeklyResetIn: string | null;
  weeklyResetAt: string | null;
  monthlyUsage: number | null;
  monthlyResetIn: string | null;
  monthlyResetAt: string | null;
  modelCount: number | null;
  configSource: string;
  updatedAt: string;
};

export type CodexMetric = {
  provider: "codex";
  status: ProviderStatus;

  planType: string | null;

  primaryUsage: number | null;
  primaryWindowMinutes: number | null;
  primaryResetAt: string | null;
  primaryResetIn: string | null;

  secondaryUsage: number | null;
  secondaryWindowMinutes: number | null;
  secondaryResetAt: string | null;
  secondaryResetIn: string | null;

  creditsBalance: string | null;
  unlimitedCredits: boolean | null;
  rateLimitReachedType: string | null;

  authSource: string;
  baseUrl: string;
  updatedAt: string;
};

export type AppCache = {
  deepseek: DeepSeekMetric | null;
  opencodeGo: OpenCodeGoMetric | null;
  codex: CodexMetric | null;
  updatedAt: string | null;
};

export type ProviderId = "deepseek" | "codex" | "cursor" | "opencode_go";

export type ProviderSnapshotStatus =
  | "ok"
  | "warning"
  | "error"
  | "stale"
  | "loading"
  | "mock";

export type ProviderSnapshot = {
  id: ProviderId;
  title: string;
  main: string;
  sub: string;
  percent?: number;
  status: ProviderSnapshotStatus;
  error?: string;
  updatedAt?: string;
};
