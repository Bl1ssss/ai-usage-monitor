import { invoke } from "@tauri-apps/api/core";
import type { AppCache } from "../types/metrics";

export async function loadCache() {
  return invoke<AppCache>("load_cache");
}

export async function saveCache(cache: AppCache) {
  return invoke<void>("save_cache", {
    cache,
  });
}
