import { invoke } from "@tauri-apps/api/core";
import type { OpenCodeGoMetric } from "../types/metrics";

export async function fetchOpenCodeGo(configPath: string) {
  return invoke<OpenCodeGoMetric>("opencode_go_usage", {
    configPath: configPath.trim() ? configPath.trim() : null,
  });
}
