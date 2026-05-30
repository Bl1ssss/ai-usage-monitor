import { invoke } from "@tauri-apps/api/core";
import type { CodexMetric } from "../types/metrics";

export async function fetchCodex(
  authPath: string,
  baseUrl: string,
  proxyUrl: string
) {
  return invoke<CodexMetric>("codex_usage", {
    authPath: authPath.trim() ? authPath.trim() : null,
    baseUrl: baseUrl.trim() ? baseUrl.trim() : null,
    proxyUrl: proxyUrl.trim() ? proxyUrl.trim() : null,
  });
}