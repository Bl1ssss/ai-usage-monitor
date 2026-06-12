import { invoke } from "@tauri-apps/api/core";
import type { DeepSeekMetric } from "../types/metrics";

export async function fetchDeepSeek(apiKey: string) {
  return invoke<DeepSeekMetric>("deepseek_balance", {
    apiKey: apiKey.trim() ? apiKey.trim() : null,
  });
}
