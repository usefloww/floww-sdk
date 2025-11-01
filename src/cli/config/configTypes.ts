export interface FlowwConfig {
  workosClientId: string;
  backendUrl: string;
  workosApiUrl: string;
  websocketUrl: string;
  registryUrl: string;
}

export interface ConfigSource {
  source: "default" | "config" | "env" | "cli";
  value: string;
}

export interface ConfigWithSources {
  workosClientId: ConfigSource;
  backendUrl: ConfigSource;
  workosApiUrl: ConfigSource;
  websocketUrl: ConfigSource;
  registryUrl: ConfigSource;
}

interface ConfigField {
  default: string;
  envVar: string;
  cliKey: string;
}

export const CONFIG_SCHEMA = {
  workosClientId: {
    default: "client_01K6QQP8Q721ZX1YM1PBV3EWMR",
    envVar: "WORKOS_CLIENT_ID",
    cliKey: "workos-client-id",
  },
  backendUrl: {
    default: "https://api.usefloww.dev",
    envVar: "FLOWW_BACKEND_URL",
    cliKey: "backend-url",
  },
  websocketUrl: {
    default: "wss://ws.usefloww.dev/connection/websocket",
    envVar: "FLOWW_WEBSOCKET_URL",
    cliKey: "websocket-url",
  },
  workosApiUrl: {
    default: "https://api.workos.com",
    envVar: "WORKOS_API_URL",
    cliKey: "workos-api-url",
  },
  registryUrl: {
    default: "registry.usefloww.dev",
    envVar: "FLOWW_REGISTRY_URL",
    cliKey: "registry-url",
  },
} as const satisfies Record<keyof FlowwConfig, ConfigField>;

export type ConfigKey = keyof FlowwConfig;
