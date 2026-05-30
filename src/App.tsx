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

export default function App() {
  const [deepseek, setDeepseek] = useState<DeepSeekMetric | null>(null);
  const [deepseekError, setDeepseekError] = useState("");
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
  async function refreshDeepSeek() {
  try {
    setRefreshStatus("refreshing");
    setDeepseekError("");

    const data = await invoke<DeepSeekMetric>("deepseek_balance", {
  apiKey: deepseekApiKey,
});

    setDeepseek(data);
    setLastUpdated(data.updatedAt);
    setRefreshStatus("ok");
  } catch (error) {
    setDeepseekError(String(error));
    setRefreshStatus("failed");
  }
}

function saveSettings() {
  localStorage.setItem("deepseekApiKey", deepseekApiKey);
  localStorage.setItem("lowBalanceThreshold", String(lowBalanceThreshold));
  localStorage.setItem("refreshIntervalMinutes", String(refreshIntervalMinutes));

  setShowSettings(false);
  refreshDeepSeek();
}


  useEffect(() => {
  refreshDeepSeek();

  const timer = window.setInterval(() => {
    refreshDeepSeek();
  }, refreshIntervalMinutes * 60 * 1000);

  return () => window.clearInterval(timer);
}, [refreshIntervalMinutes, deepseekApiKey]);

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
          main="61%"
          sub="weekly usage"
          percent={61}
        />
      </section>

      <footer className="footer">
  <span>last updated: {formatTime(lastUpdated)}</span>
  <span>{refreshStatus}</span>

  <div className="footer-actions">
    <button className="refresh-button" onClick={refreshDeepSeek}>
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

    <button className="settings-save" onClick={saveSettings}>
      SAVE SETTINGS
    </button>
  </section>
)}


    </main>
  );
}