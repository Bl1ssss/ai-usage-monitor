import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { SettingsPanel } from "./components/SettingsPanel";
import { UsageCard } from "./components/UsageCard";
import { loadCache, saveCache } from "./providers/cache";
import { fetchCodex } from "./providers/codex";
import { fetchDeepSeek } from "./providers/deepseek";
import { fetchOpenCodeGo } from "./providers/opencodeGo";
import {
  createProviderSnapshots,
  summarizeProviderStatus,
} from "./providers/snapshots";
import type { CodexMetric, DeepSeekMetric, OpenCodeGoMetric } from "./types/metrics";
import { loadSettings, saveSettings as persistSettings } from "./types/settings";
import { formatTime } from "./utils/format";

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
      fetchCodex(settings.codexAuthPath, settings.codexBaseUrl, settings.codexProxyUrl),
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

  const snapshots = useMemo(
    () =>
      createProviderSnapshots({
        settings,
        deepseek,
        deepseekError,
        opencodeGo,
        opencodeGoError,
        codex,
        codexError,
      }),
    [settings, deepseek, deepseekError, opencodeGo, opencodeGoError, codex, codexError],
  );

  const providerSummary = summarizeProviderStatus(snapshots);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="app-title">AI USAGE MONITOR</div>
          <div className="app-subtitle">Windows Desktop Widget · {providerSummary}</div>
        </div>

        <div className="weather">
          <div>SHENZHEN</div>
          <div>31°C</div>
        </div>
      </header>

      <div className="divider" />

      <section className="grid">
        {snapshots.map((snapshot) => (
          <UsageCard key={snapshot.id} snapshot={snapshot} />
        ))}
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
