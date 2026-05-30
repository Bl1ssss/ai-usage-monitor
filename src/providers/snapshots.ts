import type {
  CodexMetric,
  DeepSeekMetric,
  OpenCodeGoMetric,
  ProviderSnapshot,
  ProviderSnapshotStatus,
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
    createCursorSnapshot(),
    createOpenCodeGoSnapshot(input),
  ];
}

export function summarizeProviderStatus(snapshots: ProviderSnapshot[]) {
  const errors = snapshots.filter((item) => item.status === "error").length;
  const stale = snapshots.filter((item) => item.status === "stale").length;
  const warnings = snapshots.filter((item) => item.status === "warning").length;
  const loading = snapshots.filter((item) => item.status === "loading").length;
  const mock = snapshots.filter((item) => item.status === "mock").length;

  if (errors > 0) return `${errors} error${errors > 1 ? "s" : ""}`;
  if (loading > 0) return `${loading} loading`;
  if (stale > 0) return `${stale} stale`;
  if (warnings > 0) return `${warnings} warning${warnings > 1 ? "s" : ""}`;
  if (mock > 0) return `ok · ${mock} mock`;
  return "all ok";
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

  return {
    id: "deepseek",
    title: "DEEPSEEK",
    main: deepseek ? formatCurrency(deepseek.currency, deepseek.totalBalance) : "--",
    sub: deepseek
      ? withStaleSuffix(
          warning
            ? `LOW BALANCE / topup ${deepseek.toppedUpBalance.toFixed(2)}`
            : `grant ${deepseek.grantedBalance.toFixed(2)} / topup ${deepseek.toppedUpBalance.toFixed(2)}`,
          deepseekError,
        )
      : "loading...",
    status,
    error: deepseek ? undefined : normalizeError(deepseekError),
    updatedAt: deepseek?.updatedAt,
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

  return {
    id: "codex",
    title: codex?.planType ? `CODEX ${codex.planType}` : "CODEX",
    main: codex
      ? `${formatWindowMinutes(codex.primaryWindowMinutes)} ${formatPercent(codex.primaryUsage)}`
      : "--",
    sub: codex
      ? withStaleSuffix(
          `S ${formatPercent(codex.secondaryUsage)} / reset ${codex.primaryResetIn ?? "--"}`,
          codexError,
        )
      : "loading...",
    percent: clampPercent(codex?.primaryUsage),
    status,
    error: codex ? undefined : normalizeError(codexError),
    updatedAt: codex?.updatedAt,
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

  return {
    id: "opencode_go",
    title: "OPENCODE GO",
    main: opencodeGo ? `5h ${formatPercent(opencodeGo.fiveHourUsage)}` : "--",
    sub: opencodeGo
      ? withStaleSuffix(
          `W ${formatPercent(opencodeGo.weeklyUsage)} / M ${formatPercent(
            opencodeGo.monthlyUsage,
          )} / reset ${opencodeGo.fiveHourResetIn ?? "--"}`,
          opencodeGoError,
        )
      : "loading...",
    percent: clampPercent(opencodeGo?.fiveHourUsage),
    status,
    error: opencodeGo ? undefined : normalizeError(opencodeGoError),
    updatedAt: opencodeGo?.updatedAt,
  };
}

function createCursorSnapshot(): ProviderSnapshot {
  return {
    id: "cursor",
    title: "CURSOR",
    main: "20%",
    sub: "Auto 26.6% / API 0.0%",
    percent: 20,
    status: "mock",
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
  return error ? `${text} / stale` : text;
}

function normalizeError(error: string) {
  const value = error.trim();
  return value ? value : undefined;
}
