export interface FlowwConfig {
  workosClientId: string;
  backendUrl: string;
  workosApiUrl: string;
  websocketUrl: string;
}

export interface ConfigSource {
  source: 'default' | 'config' | 'env' | 'cli';
  value: string;
}

export interface ConfigWithSources {
  workosClientId: ConfigSource;
  backendUrl: ConfigSource;
  workosApiUrl: ConfigSource;
  websocketUrl: ConfigSource;
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
    default: "https://api.flow.toondn.app",
    envVar: "FLOWW_BACKEND_URL",
    cliKey: "backend-url",
  },
  websocketUrl: {
    default: "ws://ws.flow.toondn.app/connection/websocket",
    envVar: "FLOWW_WEBSOCKET_URL",
    cliKey: "websocket-url",
  },
  workosApiUrl: {
    default: "https://api.workos.com",
    envVar: "WORKOS_API_URL",
    cliKey: "workos-api-url",
  },
} as const satisfies Record<keyof FlowwConfig, ConfigField>;

export type ConfigKey = keyof FlowwConfig;