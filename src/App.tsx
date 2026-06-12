import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { ProviderCard } from "./components/ProviderCard";
import {
  SettingsPanel,
  type SettingsActionKey,
  type SettingsMessages,
} from "./components/SettingsPanel";
import { loadCache, saveCache } from "./providers/cache";
import { fetchCodex } from "./providers/codex";
import { fetchDeepSeek } from "./providers/deepseek";
import {
  applyDiscoveredSettings,
  chooseJsonFile,
  discoverLocalSources,
  summarizeDiscovery,
  type LocalDiscovery,
} from "./providers/discovery";
import { fetchOpenCodeGo } from "./providers/opencodeGo";
import {
  createProviderSnapshots,
  summarizeProviderStatus,
} from "./providers/snapshots";
import type { CodexMetric, DeepSeekMetric, OpenCodeGoMetric } from "./types/metrics";
import {
  loadSettings,
  saveSettings as persistSettings,
  type AppSettings,
} from "./types/settings";
import { formatTime } from "./utils/format";

function shortError(error: unknown) {
  const value = String(error).replace(/^Error:\s*/i, "").trim();
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);

  const [deepseek, setDeepseek] = useState<DeepSeekMetric | null>(null);
  const [deepseekError, setDeepseekError] = useState("");

  const [opencodeGo, setOpencodeGo] = useState<OpenCodeGoMetric | null>(null);
  const [opencodeGoError, setOpencodeGoError] = useState("");

  const [codex, setCodex] = useState<CodexMetric | null>(null);
  const [codexError, setCodexError] = useState("");

  const [discovery, setDiscovery] = useState<LocalDiscovery | null>(null);
  const [settingsBusyAction, setSettingsBusyAction] = useState<SettingsActionKey | null>(null);
  const [settingsMessages, setSettingsMessages] = useState<SettingsMessages>({});

  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "loading-cache" | "refreshing" | "ok" | "stale"
  >("idle");
  const [showSettings, setShowSettings] = useState(false);

  async function refreshAll(activeSettings: AppSettings = settings) {
    setRefreshStatus("refreshing");

    const nextUpdatedAt = new Date().toISOString();

    const [deepseekResult, opencodeResult, codexResult] = await Promise.allSettled([
      fetchDeepSeek(activeSettings.deepseekApiKey),
      fetchOpenCodeGo(activeSettings.opencodeGoConfigPath),
      fetchCodex(
        activeSettings.codexAuthPath,
        activeSettings.codexBaseUrl,
        activeSettings.codexProxyUrl,
      ),
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

    try {
      await saveCache({
        deepseek: nextDeepseek,
        opencodeGo: nextOpenCodeGo,
        codex: nextCodex,
        updatedAt: nextUpdatedAt,
      });
    } catch {
      // Provider results remain visible even if the local cache cannot be written.
    }

    const ok =
      deepseekResult.status === "fulfilled" &&
      opencodeResult.status === "fulfilled" &&
      codexResult.status === "fulfilled";

    setRefreshStatus(ok ? "ok" : "stale");
  }

  function handleSaveSettings() {
    persistSettings(settings);
    setShowSettings(false);
    void refreshAll(settings);
  }

  async function handleAutoDetect() {
    setSettingsBusyAction("detect");
    setSettingsMessages((current) => ({ ...current, detect: "detecting local sources..." }));

    try {
      const result = await discoverLocalSources();
      const merged = applyDiscoveredSettings(settings, result);

      setDiscovery(result);
      setSettings(merged.settings);

      if (merged.changed) {
        persistSettings(merged.settings);
      }

      setSettingsMessages((current) => ({
        ...current,
        detect: `${summarizeDiscovery(result)}${merged.changed ? " · paths applied" : ""}`,
      }));
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        detect: `auto detect failed: ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  async function handleChooseOpenCodeConfig() {
    setSettingsBusyAction("choose-opencode");

    try {
      const selected = await chooseJsonFile("Choose OpenCode Go config JSON");
      if (selected) {
        setSettings((current) => ({ ...current, opencodeGoConfigPath: selected }));
        setSettingsMessages((current) => ({
          ...current,
          opencodeGo: "file selected; run TEST OPENCODE to validate",
        }));
      }
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        opencodeGo: `file selection failed: ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  async function handleChooseCodexAuth() {
    setSettingsBusyAction("choose-codex");

    try {
      const selected = await chooseJsonFile("Choose Codex auth.json");
      if (selected) {
        setSettings((current) => ({ ...current, codexAuthPath: selected }));
        setSettingsMessages((current) => ({
          ...current,
          codex: "file selected; run TEST CODEX to validate",
        }));
      }
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        codex: `file selection failed: ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  async function handleTestDeepSeek() {
    setSettingsBusyAction("test-deepseek");
    setSettingsMessages((current) => ({ ...current, deepseek: "testing..." }));

    try {
      const metric = await fetchDeepSeek(settings.deepseekApiKey);
      setDeepseek(metric);
      setDeepseekError("");
      setSettingsMessages((current) => ({
        ...current,
        deepseek: `OK · ${metric.currency} ${metric.totalBalance.toFixed(2)}`,
      }));
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        deepseek: `FAILED · ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  async function handleTestOpenCodeGo() {
    setSettingsBusyAction("test-opencode");
    setSettingsMessages((current) => ({ ...current, opencodeGo: "testing..." }));

    try {
      const metric = await fetchOpenCodeGo(settings.opencodeGoConfigPath);
      setOpencodeGo(metric);
      setOpencodeGoError("");
      setSettingsMessages((current) => ({
        ...current,
        opencodeGo: `OK · 5h ${metric.fiveHourUsage?.toFixed(1) ?? "--"}%`,
      }));
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        opencodeGo: `FAILED · ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  async function handleTestCodex() {
    setSettingsBusyAction("test-codex");
    setSettingsMessages((current) => ({ ...current, codex: "testing..." }));

    try {
      const metric = await fetchCodex(
        settings.codexAuthPath,
        settings.codexBaseUrl,
        settings.codexProxyUrl,
      );
      setCodex(metric);
      setCodexError("");
      setSettingsMessages((current) => ({
        ...current,
        codex: `OK · primary ${metric.primaryUsage?.toFixed(1) ?? "--"}%`,
      }));
    } catch (error) {
      setSettingsMessages((current) => ({
        ...current,
        codex: `FAILED · ${shortError(error)}`,
      }));
    } finally {
      setSettingsBusyAction(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setRefreshStatus("loading-cache");
      const baseSettings = loadSettings();

      const [cacheResult, discoveryResult] = await Promise.allSettled([
        loadCache(),
        discoverLocalSources(),
      ]);

      if (cancelled) return;

      if (cacheResult.status === "fulfilled") {
        const cache = cacheResult.value;
        if (cache.deepseek) setDeepseek(cache.deepseek);
        if (cache.opencodeGo) setOpencodeGo(cache.opencodeGo);
        if (cache.codex) setCodex(cache.codex);
        if (cache.updatedAt) setLastUpdated(cache.updatedAt);
      }

      let resolvedSettings = baseSettings;

      if (discoveryResult.status === "fulfilled") {
        const localDiscovery = discoveryResult.value;
        const merged = applyDiscoveredSettings(baseSettings, localDiscovery);

        resolvedSettings = merged.settings;
        setDiscovery(localDiscovery);
        setSettings(resolvedSettings);
        setSettingsMessages((current) => ({
          ...current,
          detect: `${summarizeDiscovery(localDiscovery)}${merged.changed ? " · paths applied" : ""}`,
        }));

        if (merged.changed) {
          persistSettings(resolvedSettings);
        }
      } else {
        setSettingsMessages((current) => ({
          ...current,
          detect: `startup detection failed: ${shortError(discoveryResult.reason)}`,
        }));
      }

      if (!cancelled) {
        await refreshAll(resolvedSettings);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
    // Bootstrap once. Later settings changes are applied through SAVE and the interval effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshAll(settings);
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

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void listen("tray-refresh", () => {
      void refreshAll(settings);
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => dispose?.();
    // Re-register with the latest settings used by the tray refresh action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

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
  const attention = snapshots.some((snapshot) =>
    ["warning", "error", "stale"].includes(snapshot.status),
  );

  function hideToTray() {
    void invoke("hide_to_tray");
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand-block">
          <div className="app-title">AI USAGE MONITOR</div>
          <div className="app-subtitle">{providerSummary}</div>
        </div>

        <div className="topbar-actions">
          <span className={`health-dot ${attention ? "health-attention" : ""}`} />
          <button
            className="icon-button"
            onClick={() => void refreshAll(settings)}
            disabled={refreshStatus === "refreshing"}
            title="Refresh all providers"
            aria-label="Refresh all providers"
          >
            ↻
          </button>
          <button
            className="icon-button"
            onClick={() => setShowSettings(true)}
            title="Open settings"
            aria-label="Open settings"
          >
            ⚙
          </button>
          <button
            className="icon-button"
            onClick={hideToTray}
            title="Hide to system tray"
            aria-label="Hide to system tray"
          >
            ×
          </button>
        </div>
      </header>

      <section className="provider-list">
        {snapshots.map((snapshot) => (
          <ProviderCard key={snapshot.id} snapshot={snapshot} />
        ))}
      </section>

      <footer className="footer">
        <span>UPDATED {formatTime(lastUpdated)}</span>
        <span className={`refresh-state refresh-state-${refreshStatus}`}>{refreshStatus}</span>
      </footer>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          discovery={discovery}
          busyAction={settingsBusyAction}
          messages={settingsMessages}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          onAutoDetect={handleAutoDetect}
          onChooseOpenCodeConfig={handleChooseOpenCodeConfig}
          onChooseCodexAuth={handleChooseCodexAuth}
          onTestDeepSeek={handleTestDeepSeek}
          onTestOpenCodeGo={handleTestOpenCodeGo}
          onTestCodex={handleTestCodex}
        />
      )}
    </main>
  );
}
