import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type UsageCardProps = {
  title: string;
  main: string;
  sub?: string;
  percent?: number;
  error?: string;
  warning?: boolean;
};

type DeepSeekMetric = {
  provider: string;
  status: "ok" | "warning" | "error";
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
  updatedAt: string;
};

type OpenCodeGoMetric = {
  provider: string;
  status: "ok" | "warning" | "error";
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

function UsageCard({ title, main, sub, percent, error, warning }: UsageCardProps) {
  return (
    <section className={warning ? "card warning-card" : "card"}>
      <div className="card-title">{title}</div>

      <div className={error ? "card-main error-text" : "card-main"}>{main}</div>

      {typeof percent === "number" && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      {error ? <div className="card-sub error-text">{error}</div> : sub && <div className="card-sub">{sub}</div>}
    </section>
  );
}

function formatCurrency(currency: string, amount: number) {
  if (currency === "CNY") return `¥${amount.toFixed(2)}`;
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${currency}`;
}

function formatTime(value?: string) {
  if (!value) return "never";
  const date = new Date(value);
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(1)}%`;
}

function clampPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return Math.max(0, Math.min(100, value));
}

export default function App() {
  const [deepseek, setDeepseek] = useState<DeepSeekMetric | null>(null);
  const [deepseekError, setDeepseekError] = useState("");

  const [opencodeGo, setOpencodeGo] = useState<OpenCodeGoMetric | null>(null);
  const [opencodeGoError, setOpencodeGoError] = useState("");

  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "refreshing" | "ok" | "failed">("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [deepseekApiKey, setDeepseekApiKey] = useState(
  localStorage.getItem("deepseekApiKey") ?? ""
);
const [lowBalanceThreshold, setLowBalanceThreshold] = useState(
  Number(localStorage.getItem("lowBalanceThreshold") ?? "5")
);
const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState(
  Number(localStorage.getItem("refreshIntervalMinutes") ?? "5")
);

const [opencodeGoConfigPath, setOpencodeGoConfigPath] = useState(
  localStorage.getItem("opencodeGoConfigPath") ?? ""
);

const [opencodeGoWarningThreshold, setOpencodeGoWarningThreshold] = useState(
  Number(localStorage.getItem("opencodeGoWarningThreshold") ?? "80")
);


async function refreshDeepSeek() {
  try {
    setDeepseekError("");

    const data = await invoke<DeepSeekMetric>("deepseek_balance", {
      apiKey: deepseekApiKey,
    });

    setDeepseek(data);
    return true;
  } catch (error) {
    setDeepseekError(String(error));
    return false;
  }
}

async function refreshOpenCodeGo() {
  try {
    setOpencodeGoError("");

    const configPath = opencodeGoConfigPath.trim()
      ? opencodeGoConfigPath.trim()
      : null;

    const data = await invoke<OpenCodeGoMetric>("opencode_go_usage", {
      configPath,
    });

    setOpencodeGo(data);
    return true;
  } catch (error) {
    setOpencodeGoError(String(error));
    return false;
  }
}

async function refreshAll() {
  setRefreshStatus("refreshing");

  const [deepseekOk, opencodeOk] = await Promise.all([
    refreshDeepSeek(),
    refreshOpenCodeGo(),
  ]);

  setLastUpdated(new Date().toISOString());
  setRefreshStatus(deepseekOk && opencodeOk ? "ok" : "failed");
}

function saveSettings() {
  localStorage.setItem("deepseekApiKey", deepseekApiKey);
  localStorage.setItem("lowBalanceThreshold", String(lowBalanceThreshold));
  localStorage.setItem("refreshIntervalMinutes", String(refreshIntervalMinutes));
  localStorage.setItem("opencodeGoConfigPath", opencodeGoConfigPath);
  localStorage.setItem("opencodeGoWarningThreshold", String(opencodeGoWarningThreshold));

  setShowSettings(false);
  refreshAll();
}


  useEffect(() => {
  refreshAll();

  const timer = window.setInterval(() => {
    refreshAll();
  }, refreshIntervalMinutes * 60 * 1000);

  return () => window.clearInterval(timer);
}, [refreshIntervalMinutes, deepseekApiKey, opencodeGoConfigPath]);

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
      ? deepseek.totalBalance < 5
        ? `LOW BALANCE / topup ${deepseek.toppedUpBalance.toFixed(2)}`
        : `grant ${deepseek.grantedBalance.toFixed(2)} / topup ${deepseek.toppedUpBalance.toFixed(2)}`
      : "loading..."
  }
  error={deepseekError}
  warning={Boolean(deepseek && deepseek.totalBalance < lowBalanceThreshold)}
/>

        <UsageCard
          title="CODEX"
          main="87%"
          sub="reset in 0h43m"
          percent={87}
        />

        <UsageCard
          title="CURSOR"
          main="20%"
          sub="Auto 26.6% / API 0.0%"
          percent={20}
        />

        <UsageCard
  title="OPENCODE GO"
  main={
    opencodeGo
      ? `5h ${formatPercent(opencodeGo.fiveHourUsage)}`
      : "--"
  }
  sub={
    opencodeGo
      ? `W ${formatPercent(opencodeGo.weeklyUsage)} / M ${formatPercent(
          opencodeGo.monthlyUsage
        )} / reset ${opencodeGo.fiveHourResetIn ?? "--"}`
      : "loading..."
  }
  percent={clampPercent(opencodeGo?.fiveHourUsage)}
  error={opencodeGoError}
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
          value >= opencodeGoWarningThreshold
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
  <section className="settings-panel">
    <div className="settings-header">
      <span>SETTINGS</span>
      <button className="refresh-button" onClick={() => setShowSettings(false)}>
        close
      </button>
    </div>

    <label className="settings-label">
      DeepSeek API Key
      <input
        className="settings-input"
        type="password"
        value={deepseekApiKey}
        onChange={(event) => setDeepseekApiKey(event.target.value)}
        placeholder="sk-..."
      />
    </label>

    <label className="settings-label">
      Low balance threshold
      <input
        className="settings-input"
        type="number"
        min="0"
        value={lowBalanceThreshold}
        onChange={(event) => setLowBalanceThreshold(Number(event.target.value))}
      />
    </label>

    <label className="settings-label">
      Refresh interval minutes
      <input
        className="settings-input"
        type="number"
        min="1"
        value={refreshIntervalMinutes}
        onChange={(event) => setRefreshIntervalMinutes(Number(event.target.value))}
      />
    </label>

<div className="settings-section-title">OPENCODE GO</div>

<label className="settings-label">
  Config file path
  <input
    className="settings-input"
    value={opencodeGoConfigPath}
    onChange={(event) => setOpencodeGoConfigPath(event.target.value)}
    placeholder="%APPDATA%\\ai-usage-monitor\\opencode-go.json"
  />
</label>

<label className="settings-label">
  Warning threshold percent
  <input
    className="settings-input"
    type="number"
    min="1"
    max="100"
    value={opencodeGoWarningThreshold}
    onChange={(event) =>
      setOpencodeGoWarningThreshold(Number(event.target.value))
    }
  />
</label>


    <button className="settings-save" onClick={saveSettings}>
      SAVE SETTINGS
    </button>
  </section>
)}


    </main>
  );
}