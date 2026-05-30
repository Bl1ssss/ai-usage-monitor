export type AppSettings = {
  deepseekApiKey: string;
  lowBalanceThreshold: number;
  refreshIntervalMinutes: number;
  opencodeGoConfigPath: string;
  opencodeGoWarningThreshold: number;
};

export function loadSettings(): AppSettings {
  return {
    deepseekApiKey: localStorage.getItem("deepseekApiKey") ?? "",
    lowBalanceThreshold: Number(localStorage.getItem("lowBalanceThreshold") ?? "5"),
    refreshIntervalMinutes: Number(localStorage.getItem("refreshIntervalMinutes") ?? "5"),
    opencodeGoConfigPath: localStorage.getItem("opencodeGoConfigPath") ?? "",
    opencodeGoWarningThreshold: Number(
      localStorage.getItem("opencodeGoWarningThreshold") ?? "80",
    ),
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem("deepseekApiKey", settings.deepseekApiKey);
  localStorage.setItem("lowBalanceThreshold", String(settings.lowBalanceThreshold));
  localStorage.setItem("refreshIntervalMinutes", String(settings.refreshIntervalMinutes));
  localStorage.setItem("opencodeGoConfigPath", settings.opencodeGoConfigPath);
  localStorage.setItem("opencodeGoWarningThreshold", String(settings.opencodeGoWarningThreshold));
}
