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

export type AppCache = {
  deepseek: DeepSeekMetric | null;
  opencodeGo: OpenCodeGoMetric | null;
  updatedAt: string | null;
};
