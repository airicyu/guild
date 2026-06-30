/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GUILD_API_URL?: string;
  readonly VITE_GUILD_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
