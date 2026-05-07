/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZABBIX_URL: string
  readonly VITE_GLPI_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
