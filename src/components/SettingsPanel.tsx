import type { AppSettings } from "../types/settings";

type SettingsPanelProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  onSave: () => void;
};

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onSave,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <div className="settings-header">
        <span>SETTINGS</span>
        <button className="refresh-button" onClick={onClose}>
          close
        </button>
      </div>

      <label className="settings-label">
        DeepSeek API Key
        <input
          className="settings-input"
          type="password"
          value={settings.deepseekApiKey}
          onChange={(event) =>
            onChange({ ...settings, deepseekApiKey: event.target.value })
          }
          placeholder="sk-..."
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

      <div className="settings-section-title">OPENCODE GO</div>

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

      <button className="settings-save" onClick={onSave}>
        SAVE SETTINGS
      </button>
    </section>
  );
}
