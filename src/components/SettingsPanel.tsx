import type { LocalDiscovery, SourceCheck } from "../providers/discovery";
import type { AppSettings } from "../types/settings";

export type SettingsActionKey =
  | "detect"
  | "choose-opencode"
  | "choose-codex"
  | "test-deepseek"
  | "test-opencode"
  | "test-codex";

export type SettingsMessageKey = "detect" | "deepseek" | "opencodeGo" | "codex";
export type SettingsMessages = Partial<Record<SettingsMessageKey, string>>;

type SettingsPanelProps = {
  settings: AppSettings;
  discovery: LocalDiscovery | null;
  busyAction: SettingsActionKey | null;
  messages: SettingsMessages;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  onSave: () => void;
  onAutoDetect: () => void | Promise<void>;
  onChooseOpenCodeConfig: () => void | Promise<void>;
  onChooseCodexAuth: () => void | Promise<void>;
  onTestDeepSeek: () => void | Promise<void>;
  onTestOpenCodeGo: () => void | Promise<void>;
  onTestCodex: () => void | Promise<void>;
};

type SourceStatusProps = {
  check?: SourceCheck;
  configured?: boolean;
  configuredMessage?: string;
};

function SourceStatus({ check, configured, configuredMessage }: SourceStatusProps) {
  if (configured && !check?.usable) {
    return (
      <div className="source-status source-status-configured">
        CONFIGURED · {configuredMessage ?? "manual value configured; run TEST to verify"}
      </div>
    );
  }

  if (!check) {
    return <div className="source-status source-status-pending">NOT SCANNED</div>;
  }

  const stateClass = check.usable
    ? "source-status-ok"
    : check.found
      ? "source-status-warning"
      : "source-status-missing";
  const label = check.usable ? "FOUND" : check.found ? "CHECK" : "MISSING";

  return (
    <div className={`source-status ${stateClass}`} title={check.path ?? check.source}>
      {label} · {check.message}
    </div>
  );
}

function ActionMessage({ value }: { value?: string }) {
  return value ? <div className="settings-message">{value}</div> : null;
}

export function SettingsPanel({
  settings,
  discovery,
  busyAction,
  messages,
  onChange,
  onClose,
  onSave,
  onAutoDetect,
  onChooseOpenCodeConfig,
  onChooseCodexAuth,
  onTestDeepSeek,
  onTestOpenCodeGo,
  onTestCodex,
}: SettingsPanelProps) {
  const actionsDisabled = busyAction !== null;

  return (
    <section className="settings-panel">
      <div className="settings-header">
        <span>SETTINGS</span>
        <div className="settings-header-actions">
          <button
            className="refresh-button"
            onClick={onAutoDetect}
            disabled={actionsDisabled}
          >
            {busyAction === "detect" ? "detecting..." : "auto detect"}
          </button>
          <button className="refresh-button" onClick={onClose} disabled={actionsDisabled}>
            close
          </button>
        </div>
      </div>

      <ActionMessage value={messages.detect} />

      <div className="settings-section-title settings-section-title-first">DEEPSEEK</div>
      <SourceStatus
        check={discovery?.deepseekEnv}
        configured={Boolean(settings.deepseekApiKey.trim())}
        configuredMessage="manual API key configured"
      />

      <label className="settings-label">
        DeepSeek API Key
        <input
          className="settings-input"
          type="password"
          value={settings.deepseekApiKey}
          onChange={(event) =>
            onChange({ ...settings, deepseekApiKey: event.target.value })
          }
          placeholder="leave blank to use DEEPSEEK_API_KEY"
          autoComplete="off"
        />
      </label>

      <label className="settings-label">
        Low balance threshold
        <input
          className="settings-input"
          type="number"
          min="0"
          value={settings.lowBalanceThreshold}
          onChange={(event) =>
            onChange({
              ...settings,
              lowBalanceThreshold: Number(event.target.value),
            })
          }
        />
      </label>

      <div className="settings-actions">
        <button
          className="settings-action"
          onClick={onTestDeepSeek}
          disabled={actionsDisabled}
        >
          {busyAction === "test-deepseek" ? "testing..." : "test deepseek"}
        </button>
      </div>
      <ActionMessage value={messages.deepseek} />

      <div className="settings-section-title">OPENCODE GO</div>
      <SourceStatus
        check={discovery?.opencodeGoConfig}
        configured={Boolean(settings.opencodeGoConfigPath.trim())}
        configuredMessage="config path configured"
      />

      <label className="settings-label">
        Config file path
        <input
          className="settings-input"
          value={settings.opencodeGoConfigPath}
          onChange={(event) =>
            onChange({ ...settings, opencodeGoConfigPath: event.target.value })
          }
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
          value={settings.opencodeGoWarningThreshold}
          onChange={(event) =>
            onChange({
              ...settings,
              opencodeGoWarningThreshold: Number(event.target.value),
            })
          }
        />
      </label>

      <div className="settings-actions">
        <button
          className="settings-action"
          onClick={onChooseOpenCodeConfig}
          disabled={actionsDisabled}
        >
          {busyAction === "choose-opencode" ? "opening..." : "choose file"}
        </button>
        <button
          className="settings-action"
          onClick={onTestOpenCodeGo}
          disabled={actionsDisabled}
        >
          {busyAction === "test-opencode" ? "testing..." : "test opencode"}
        </button>
      </div>
      <ActionMessage value={messages.opencodeGo} />

      <div className="settings-section-title">CODEX</div>
      <SourceStatus
        check={discovery?.codexAuth}
        configured={Boolean(settings.codexAuthPath.trim())}
        configuredMessage="auth path configured"
      />

      <label className="settings-label">
        Auth file path
        <input
          className="settings-input"
          value={settings.codexAuthPath}
          onChange={(event) =>
            onChange({ ...settings, codexAuthPath: event.target.value })
          }
          placeholder="%USERPROFILE%\\.codex\\auth.json"
        />
      </label>

      <label className="settings-label">
        Base URL
        <input
          className="settings-input"
          value={settings.codexBaseUrl}
          onChange={(event) =>
            onChange({ ...settings, codexBaseUrl: event.target.value })
          }
          placeholder="https://chatgpt.com"
        />
      </label>

      <SourceStatus
        check={discovery?.proxyEnv}
        configured={Boolean(settings.codexProxyUrl.trim())}
        configuredMessage="proxy configured manually"
      />

      <label className="settings-label">
        Proxy URL
        <input
          className="settings-input"
          value={settings.codexProxyUrl}
          onChange={(event) =>
            onChange({ ...settings, codexProxyUrl: event.target.value })
          }
          placeholder="leave blank to use HTTP_PROXY / HTTPS_PROXY"
        />
      </label>

      <label className="settings-label">
        Warning threshold percent
        <input
          className="settings-input"
          type="number"
          min="1"
          max="100"
          value={settings.codexWarningThreshold}
          onChange={(event) =>
            onChange({
              ...settings,
              codexWarningThreshold: Number(event.target.value),
            })
          }
        />
      </label>

      <div className="settings-actions">
        <button
          className="settings-action"
          onClick={onChooseCodexAuth}
          disabled={actionsDisabled}
        >
          {busyAction === "choose-codex" ? "opening..." : "choose file"}
        </button>
        <button
          className="settings-action"
          onClick={onTestCodex}
          disabled={actionsDisabled}
        >
          {busyAction === "test-codex" ? "testing..." : "test codex"}
        </button>
      </div>
      <ActionMessage value={messages.codex} />

      <div className="settings-section-title">GENERAL</div>
      <label className="settings-label">
        Refresh interval minutes
        <input
          className="settings-input"
          type="number"
          min="1"
          value={settings.refreshIntervalMinutes}
          onChange={(event) =>
            onChange({
              ...settings,
              refreshIntervalMinutes: Number(event.target.value),
            })
          }
        />
      </label>

      <button className="settings-save" onClick={onSave} disabled={actionsDisabled}>
        SAVE SETTINGS
      </button>
    </section>
  );
}
