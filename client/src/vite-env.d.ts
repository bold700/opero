/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TENANT_ROOT_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
