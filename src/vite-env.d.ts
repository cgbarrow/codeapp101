/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_DATAVERSE_SMOKE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
