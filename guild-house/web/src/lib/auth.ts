const STORAGE_KEY = "guildApiKey";
const FALLBACK_KEY = "change-me-in-production";

function envApiKey(): string | undefined {
  const value = import.meta.env.VITE_GUILD_API_KEY;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Saved key → dev env → hardcoded fallback (match guild-house/.env in prod). */
export function getApiKeyOrDefault(): string {
  return getApiKey() ?? envApiKey() ?? FALLBACK_KEY;
}

export function hasStoredApiKey(): boolean {
  return Boolean(getApiKey());
}

export function hasEnvApiKey(): boolean {
  return Boolean(envApiKey());
}

export function hasConfiguredApiKey(): boolean {
  return hasStoredApiKey() || hasEnvApiKey();
}
