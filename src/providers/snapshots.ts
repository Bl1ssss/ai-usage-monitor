import type {
  CodexMetric,
  DeepSeekMetric,
  OpenCodeGoMetric,
  ProviderSnapshot,
  ProviderSnapshotStatus,
  UsageProgressSnapshot,
} from "../types/metrics";
import type { AppSettings } from "../types/settings";
import {
  clampPercent,
  formatCurrency,
  formatPercent,
  formatWindowMinutes,
} from "../utils/format";

type SnapshotInput = {
  settings: AppSettings;
  deepseek: DeepSeekMetric | null;
  deepseekError: string;
  opencodeGo: OpenCodeGoMetric | null;
  opencodeGoError: string;
  codex: CodexMetric | null;
  codexError: string;
};

export function createProviderSnapshots(input: SnapshotInput): ProviderSnapshot[] {
  return [
    createDeepSeekSnapshot(input),
    createCodexSnapshot(input),
    createOpenCodeGoSnapshot(input),
    createCursorSnapshot(),
  ];
}

export function summarizeProviderStatus(snapshots: ProviderSnapshot[]) {
  const active = snapshots.filter((item) => item.status !== "mock");
  const errors = active.filter((item) => item.status === "error").length;
  const stale = active.filter((item) => item.status === "stale").length;
  const warnings = active.filter((item) => item.status === "warning").length;
  const loading = active.filter((item) => item.status === "loading").length;

  if (errors > 0) return `${active.length} ACTIVE · ${errors} ERROR`;
  if (loading > 0) return `${active.length} ACTIVE · ${loading} SYNCING`;
  if (stale > 0) return `${active.length} ACTIVE · ${stale} STALE`;
  if (warnings > 0) return `${active.length} ACTIVE · ${warnings} WARNING`;
  return `${active.length} ACTIVE · ALL OK`;
}

function createDeepSeekSnapshot({
  settings,
  deepseek,
  deepseekError,
}: SnapshotInput): ProviderSnapshot {
  const warning = Boolean(
    deepseek && deepseek.totalBalance < settings.lowBalanceThreshold,
  );
  const status = resolveSnapshotStatus(deepseek, deepseekError, warning);

  if (!deepseek) {
    return {
      id: "deepseek",
      title: "DEEPSEEK",
      main: deepseekError ? "UNAVAILABLE" : "SYNCING",
      mainLabel: "AVAILABLE BALANCE",
      subtitle: deepseekError ? "Open settings to verify the API key" : "Reading account balance...",
      rows: [],
      status,
      error: normalizeError(deepseekError),
    };
  }

  return {
    id: "deepseek",
    title: "DEEPSEEK",
    main: formatCurrency(deepseek.currency, deepseek.totalBalance),
    mainLabel: "AVAILABLE BALANCE",
    subtitle: withStaleSuffix(
      warning
        ? `LOW BALANCE · TOP-UP ${deepseek.toppedUpBalance.toFixed(2)}`
        : `GRANT ${deepseek.grantedBalance.toFixed(2)} · TOP-UP ${deepseek.toppedUpBalance.toFixed(2)}`,
      deepseekError,
    ),
    rows: [],
    status,
    updatedAt: deepseek.updatedAt,
  };
}

function createCodexSnapshot({
  settings,
  codex,
  codexError,
}: SnapshotInput): ProviderSnapshot {
  const warning = Boolean(
    codex &&
      [codex.primaryUsage, codex.secondaryUsage].some(
        (value) => value !== null && value !== undefined && value >= settings.codexWarningThreshold,
      ),
  );
  const status = resolveSnapshotStatus(codex, codexError, warning);

  if (!codex) {
    return {
      id: "codex",
      title: "CODEX",
      main: codexError ? "UNAVAILABLE" : "SYNCING",
      mainLabel: "RATE LIMITS",
      subtitle: codexError ? "Check auth.json and proxy settings" : "Reading usage windows...",
      rows: [],
      status,
      error: normalizeError(codexError),
    };
  }

  const rows: UsageProgressSnapshot[] = [
    createUsageRow(
      "primary",
      formatWindowMinutes(codex.primaryWindowMinutes),
      codex.primaryUsage,
      codex.primaryResetIn,
    ),
    createUsageRow(
      "secondary",
      formatWindowMinutes(codex.secondaryWindowMinutes),
      codex.secondaryUsage,
      codex.secondaryResetIn,
    ),
  ];

  const creditsText = codex.unlimitedCredits
    ? "UNLIMITED CREDITS"
    : codex.creditsBalance
      ? `CREDITS ${codex.creditsBalance}`
      : "PRIMARY + SECONDARY WINDOWS";

  return {
    id: "codex",
    title: codex.planType ? `CODEX ${codex.planType.toUpperCase()}` : "CODEX",
    subtitle: withStaleSuffix(creditsText, codexError),
    rows,
    status,
    updatedAt: codex.updatedAt,
  };
}

function createOpenCodeGoSnapshot({
  settings,
  opencodeGo,
  opencodeGoError,
}: SnapshotInput): ProviderSnapshot {
  const warning = Boolean(
    opencodeGo &&
      [opencodeGo.fiveHourUsage, opencodeGo.weeklyUsage, opencodeGo.monthlyUsage].some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value >= settings.opencodeGoWarningThreshold,
      ),
  );
  const status = resolveSnapshotStatus(opencodeGo, opencodeGoError, warning);

  if (!opencodeGo) {
    return {
      id: "opencode_go",
      title: "OPENCODE GO",
      main: opencodeGoError ? "UNAVAILABLE" : "SYNCING",
      mainLabel: "PLAN USAGE",
      subtitle: opencodeGoError ? "Check workspace and cookie configuration" : "Reading dashboard usage...",
      rows: [],
      status,
      error: normalizeError(opencodeGoError),
    };
  }

  return {
    id: "opencode_go",
    title: "OPENCODE GO",
    subtitle: withStaleSuffix("ROLLING USAGE WINDOWS", opencodeGoError),
    rows: [
      createUsageRow("rolling", "5H", opencodeGo.fiveHourUsage, opencodeGo.fiveHourResetIn),
      createUsageRow("weekly", "WEEK", opencodeGo.weeklyUsage, opencodeGo.weeklyResetIn),
      createUsageRow("monthly", "MONTH", opencodeGo.monthlyUsage, opencodeGo.monthlyResetIn),
    ],
    status,
    updatedAt: opencodeGo.updatedAt,
  };
}

function createCursorSnapshot(): ProviderSnapshot {
  return {
    id: "cursor",
    title: "CURSOR",
    main: "NOT CONNECTED",
    mainLabel: "PROVIDER ADAPTER",
    subtitle: "Real usage integration is reserved for the next version",
    rows: [],
    status: "mock",
  };
}

function createUsageRow(
  id: string,
  label: string,
  value: number | null | undefined,
  resetText?: string | null,
): UsageProgressSnapshot {
  return {
    id,
    label: label === "--" ? "WINDOW" : label.toUpperCase(),
    percent: clampPercent(value) ?? 0,
    valueText: formatPercent(value),
    resetText: resetText ?? undefined,
  };
}

function resolveSnapshotStatus<T>(
  metric: T | null,
  error: string,
  warning: boolean,
): ProviderSnapshotStatus {
  if (!metric && error) return "error";
  if (!metric) return "loading";
  if (error) return "stale";
  if (warning) return "warning";
  return "ok";
}

function withStaleSuffix(text: string, error: string) {
  return error ? `${text} · CACHED` : text;
}

function normalizeError(error: string) {
  const value = error.trim();
  if (!value) return undefined;
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}
