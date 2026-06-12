import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "../types/settings";

export type SourceCheck = {
  found: boolean;
  usable: boolean;
  path: string | null;
  value: string | null;
  source: string;
  message: string;
};

export type LocalDiscovery = {
  codexAuth: SourceCheck;
  opencodeGoConfig: SourceCheck;
  deepseekEnv: SourceCheck;
  proxyEnv: SourceCheck;
};

export type DiscoveryMergeResult = {
  settings: AppSettings;
  changed: boolean;
};

export function discoverLocalSources() {
  return invoke<LocalDiscovery>("discover_local_sources");
}

export function applyDiscoveredSettings(
  current: AppSettings,
  discovery: LocalDiscovery,
): DiscoveryMergeResult {
  const next = { ...current };

  if (
    !next.codexAuthPath.trim() &&
    discovery.codexAuth.usable &&
    discovery.codexAuth.path
  ) {
    next.codexAuthPath = discovery.codexAuth.path;
  }

  if (
    !next.opencodeGoConfigPath.trim() &&
    discovery.opencodeGoConfig.usable &&
    discovery.opencodeGoConfig.path
  ) {
    next.opencodeGoConfigPath = discovery.opencodeGoConfig.path;
  }

  if (!next.codexProxyUrl.trim() && discovery.proxyEnv.usable && discovery.proxyEnv.value) {
    next.codexProxyUrl = discovery.proxyEnv.value;
  }

  return {
    settings: next,
    changed:
      next.codexAuthPath !== current.codexAuthPath ||
      next.opencodeGoConfigPath !== current.opencodeGoConfigPath ||
      next.codexProxyUrl !== current.codexProxyUrl,
  };
}

export async function chooseJsonFile(title: string) {
  const selected = await open({
    title,
    multiple: false,
    directory: false,
    filters: [
      {
        name: "JSON files",
        extensions: ["json"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export function summarizeDiscovery(discovery: LocalDiscovery) {
  const sources = [
    discovery.deepseekEnv,
    discovery.codexAuth,
    discovery.opencodeGoConfig,
    discovery.proxyEnv,
  ];
  const usable = sources.filter((source) => source.usable).length;
  return `${usable}/${sources.length} local sources ready`;
}
