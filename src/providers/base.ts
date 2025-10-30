import { Provider, SecretDefinition, Trigger, Action } from "../common";

export type BaseProviderConfig = {
  credential?: string;
  [key: string]: any; // Allow additional config properties
};

export abstract class BaseProvider implements Provider {
  abstract providerType: string;
  credentialName: string;
  secretDefinitions?: SecretDefinition[];
  abstract triggers: Record<string, (...args: any[]) => Trigger>;
  abstract actions: any;

  protected config: Record<string, any> = {};
  private secrets: Record<string, string> = {};

  constructor(config?: BaseProviderConfig | string) {
    // Support both old string pattern and new object pattern
    if (typeof config === "string") {
      this.credentialName = config;
    } else if (config) {
      this.credentialName = config.credential || "default";
      const { credential, ...rest } = config;
      this.config = rest;
    } else {
      this.credentialName = "default";
    }
  }

  configure(secrets: Record<string, string>): void {
    console.log("Secrets", secrets);
    this.secrets = secrets;
  }

  protected getSecret(key: string): string {
    // Check secrets first (from backend credentials)
    const secretValue = this.secrets[key];
    if (secretValue) {
      return secretValue;
    }

    // Fallback to config (allows passing API keys directly)
    const configValue = this.config[key];
    if (configValue) {
      return configValue;
    }

    // Finally check environment variables (e.g., OPENAI_API_KEY)
    const envKey = `${this.providerType.toUpperCase()}_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue) {
      return envValue;
    }

    throw new Error(
      `${this.providerType} credential '${this.credentialName}' not configured. Missing secret: ${key}`,
    );
  }

  protected hasSecret(key: string): boolean {
    return !!this.secrets[key];
  }

  protected getConfig<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
}
