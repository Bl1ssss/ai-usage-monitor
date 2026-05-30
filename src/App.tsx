import { useEffect, useState } from "react";
import "./App.css";
import { SettingsPanel } from "./components/SettingsPanel";
import { UsageCard } from "./components/UsageCard";
import { loadCache, saveCache } from "./providers/cache";
import { fetchDeepSeek } from "./providers/deepseek";
import { fetchOpenCodeGo } from "./providers/opencodeGo";
import type { DeepSeekMetric, OpenCodeGoMetric } from "./types/metrics";
import { loadSettings, saveSettings as persistSettings } from "./types/settings";
import { clampPercent, formatCurrency, formatPercent, formatTime } from "./utils/format";

export default function App() {
  const [settings, setSettings] = useState(loadSettings);

  const [deepseek, setDeepseek] = useState<DeepSeekMetric | null>(null);
  const [deepseekError, setDeepseekError] = useState("");

  const [opencodeGo, setOpencodeGo] = useState<OpenCodeGoMetric | null>(null);
  const [opencodeGoError, setOpencodeGoError] = useState("");

  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "loading-cache" | "refreshing" | "ok" | "stale"
  >("idle");
  const [showSettings, setShowSettings] = useState(false);

  async function refreshAll() {
    setRefreshStatus("refreshing");

    const nextUpdatedAt = new Date().toISOString();

    const [deepseekResult, opencodeResult] = await Promise.allSettled([
      fetchDeepSeek(settings.deepseekApiKey),
      fetchOpenCodeGo(settings.opencodeGoConfigPath),
    ]);

    let nextDeepseek = deepseek;
    let nextOpenCodeGo = opencodeGo;

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

    setLastUpdated(nextUpdatedAt);

    await saveCache({
      deepseek: nextDeepseek,
      opencodeGo: nextOpenCodeGo,
      updatedAt: nextUpdatedAt,
    });

    const ok =
      deepseekResult.status === "fulfilled" &&
      opencodeResult.status === "fulfilled";

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

        <UsageCard title="CODEX" main="87%" sub="reset in 0h43m" percent={87} />

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
