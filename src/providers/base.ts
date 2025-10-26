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
  abstract actions: Record<string, (...args: any[]) => Action>;

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
    const value = this.secrets[key];
    if (!value) {
      throw new Error(
        `${this.providerType} credential '${this.credentialName}' not configured. Missing secret: ${key}`,
      );
    }
    return value;
  }

  protected hasSecret(key: string): boolean {
    return !!this.secrets[key];
  }

  protected getConfig<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
}
