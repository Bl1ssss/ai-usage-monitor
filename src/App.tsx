import { useEffect, useState } from "react";
import "./App.css";
import { SettingsPanel } from "./components/SettingsPanel";
import { UsageCard } from "./components/UsageCard";
import { loadCache, saveCache } from "./providers/cache";
import { fetchDeepSeek } from "./providers/deepseek";
import { fetchOpenCodeGo } from "./providers/opencodeGo";
import type {CodexMetric,DeepSeekMetric,OpenCodeGoMetric,} from "./types/metrics";
import { loadSettings, saveSettings as persistSettings } from "./types/settings";
import {clampPercent,formatCurrency,formatPercent,formatTime,formatWindowMinutes,} from "./utils/format";
import { fetchCodex } from "./providers/codex";



export default function App() {
  const [settings, setSettings] = useState(loadSettings);

  const [deepseek, setDeepseek] = useState<DeepSeekMetric | null>(null);
  const [deepseekError, setDeepseekError] = useState("");

  const [opencodeGo, setOpencodeGo] = useState<OpenCodeGoMetric | null>(null);
  const [opencodeGoError, setOpencodeGoError] = useState("");

  const [codex, setCodex] = useState<CodexMetric | null>(null);
  const [codexError, setCodexError] = useState("");

  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "loading-cache" | "refreshing" | "ok" | "stale"
  >("idle");
  const [showSettings, setShowSettings] = useState(false);

  async function refreshAll() {
    setRefreshStatus("refreshing");

    const nextUpdatedAt = new Date().toISOString();

    const [deepseekResult, opencodeResult, codexResult] = await Promise.allSettled([
      fetchDeepSeek(settings.deepseekApiKey),
      fetchOpenCodeGo(settings.opencodeGoConfigPath),
      fetchCodex(settings.codexAuthPath,settings.codexBaseUrl,settings.codexProxyUrl),
    ]);

    let nextDeepseek = deepseek;
    let nextOpenCodeGo = opencodeGo;
    let nextCodex = codex;

    if (deepseekResult.status === "fulfilled") {
      nextDeepseek = deepseekResult.value;
      setDeepseek(nextDeepseek);
      setDeepseekError("");
    } else {
      setDeepseekError(String(deepseekResult.reason));
    }

    if (opencodeResult.status === "fulfilled") {
      nextOpenCodeGo = opencodeResult.value;
      setOpencodeGo(nextOpenCodeGo);
      setOpencodeGoError("");
    } else {
      setOpencodeGoError(String(opencodeResult.reason));
    }

    if (codexResult.status === "fulfilled") {
      nextCodex = codexResult.value;
      setCodex(nextCodex);
      setCodexError("");
    } else {
      setCodexError(String(codexResult.reason));
    }

    setLastUpdated(nextUpdatedAt);

    await saveCache({
      deepseek: nextDeepseek,
      opencodeGo: nextOpenCodeGo,
      codex: nextCodex,
      updatedAt: nextUpdatedAt,
    });

    const ok =
      deepseekResult.status === "fulfilled" &&
      opencodeResult.status === "fulfilled" &&
      codexResult.status === "fulfilled";

    setRefreshStatus(ok ? "ok" : "stale");
  }

  function handleSaveSettings() {
    persistSettings(settings);
    setShowSettings(false);
    refreshAll();
  }

  useEffect(() => {
    setRefreshStatus("loading-cache");

    loadCache()
      .then((cache) => {
        if (cache.deepseek) setDeepseek(cache.deepseek);
        if (cache.opencodeGo) setOpencodeGo(cache.opencodeGo);
        if (cache.codex) setCodex(cache.codex);
        if (cache.updatedAt) setLastUpdated(cache.updatedAt);
      })
      .catch(() => {
        setRefreshStatus("stale");
      })
      .finally(() => {
        refreshAll();
      });
    // Run once on app startup; settings changes are handled by save button and interval effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshAll();
    }, settings.refreshIntervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.refreshIntervalMinutes,
    settings.deepseekApiKey,
    settings.opencodeGoConfigPath,
    settings.codexAuthPath,
    settings.codexBaseUrl,
    settings.codexProxyUrl,
  ]);

  const deepseekWarning = Boolean(
    deepseek && deepseek.totalBalance < settings.lowBalanceThreshold,
  );

  const opencodeWarning = Boolean(
    opencodeGo &&
      [
        opencodeGo.fiveHourUsage,
        opencodeGo.weeklyUsage,
        opencodeGo.monthlyUsage,
      ].some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value >= settings.opencodeGoWarningThreshold,
      ),
  );

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="app-title">AI USAGE MONITOR</div>
          <div className="app-subtitle">Windows Desktop Widget</div>
        </div>

        <div className="weather">
          <div>SHENZHEN</div>
          <div>31°C</div>
        </div>
      </header>

      <div className="divider" />

      <section className="grid">
        <UsageCard
          title="DEEPSEEK"
          main={deepseek ? formatCurrency(deepseek.currency, deepseek.totalBalance) : "--"}
          sub={
            deepseek
              ? deepseekWarning
                ? `LOW BALANCE / topup ${deepseek.toppedUpBalance.toFixed(2)}`
                : `grant ${deepseek.grantedBalance.toFixed(2)} / topup ${deepseek.toppedUpBalance.toFixed(2)}`
              : "loading..."
          }
          error={deepseekError}
          warning={deepseekWarning}
        />

        <UsageCard
  title={codex?.planType ? `CODEX ${codex.planType}` : "CODEX"}
  main={
    codex
      ? `${formatWindowMinutes(codex.primaryWindowMinutes)} ${formatPercent(
          codex.primaryUsage
        )}`
      : "--"
  }
  sub={
    codex
      ? `S ${formatPercent(codex.secondaryUsage)} / reset ${
          codex.primaryResetIn ?? "--"
        }${codexError ? " / stale" : ""}`
      : "loading..."
  }
  percent={clampPercent(codex?.primaryUsage)}
  error={!codex ? codexError : ""}
  warning={Boolean(
    codex &&
      [
        codex.primaryUsage,
        codex.secondaryUsage,
      ].some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value >= settings.codexWarningThreshold
      )
  )}
/>

        <UsageCard
          title="CURSOR"
          main="20%"
          sub="Auto 26.6% / API 0.0%"
          percent={20}
        />

        <UsageCard
  title="OPENCODE GO"
  main={opencodeGo ? `5h ${formatPercent(opencodeGo.fiveHourUsage)}` : "--"}
  sub={
    opencodeGo
      ? `W ${formatPercent(opencodeGo.weeklyUsage)} / M ${formatPercent(
          opencodeGo.monthlyUsage
        )} / reset ${opencodeGo.fiveHourResetIn ?? "--"}${
          opencodeGoError ? " / stale" : ""
        }`
      : "loading..."
  }
  percent={clampPercent(opencodeGo?.fiveHourUsage)}
  error={!opencodeGo ? opencodeGoError : ""}
  warning={Boolean(
    opencodeGo &&
      [
        opencodeGo.fiveHourUsage,
        opencodeGo.weeklyUsage,
        opencodeGo.monthlyUsage,
      ].some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value >= settings.opencodeGoWarningThreshold
      )
  )}
/>
      </section>

      <footer className="footer">
        <span>last updated: {formatTime(lastUpdated)}</span>
        <span>{refreshStatus}</span>

        <div className="footer-actions">
          <button className="refresh-button" onClick={refreshAll}>
            refresh
          </button>

          <button className="refresh-button" onClick={() => setShowSettings(true)}>
            settings
          </button>
        </div>
      </footer>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
    </main>
  );
}
