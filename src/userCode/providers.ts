import { Builtin } from "@/providers";
import { Gitlab } from "../providers/gitlab";
import { Slack } from "../providers/slack";

const _usedProviders = new Set<string>();
const _registeredTriggers = new Set<any>();
const _providerConfigs: Map<string, Record<string, any>> = new Map();

export function getUsedProviders() {
  return Array.from(_usedProviders).map((s) => {
    const [type, alias] = s.split(":");
    return { type, alias };
  });
}

export function setProviderConfigs(configs: Record<string, any>): void {
  _providerConfigs.clear();
  for (const [key, config] of Object.entries(configs)) {
    _providerConfigs.set(key, config);
  }
}

export function getProviderConfig(
  provider: string,
  alias: string
): Record<string, any> | undefined {
  const key = `${provider}:${alias}`;
  return _providerConfigs.get(key);
}

export function registerTrigger(trigger: any) {
  _registeredTriggers.add(trigger);
  return trigger;
}

export function getRegisteredTriggers() {
  return Array.from(_registeredTriggers);
}

export function clearRegisteredTriggers() {
  _registeredTriggers.clear();
}

export function clearUsedProviders() {
  _usedProviders.clear();
}

const providers = {
  gitlab: Gitlab,
  slack: Slack,
  builtin: Builtin,
};

type ProviderName = keyof typeof providers;
type ProviderInstance<T extends ProviderName> = InstanceType<
  (typeof providers)[T]
>;

export function getProvider<T extends ProviderName>(
  provider: T,
  alias = "default"
): ProviderInstance<T> {
  _usedProviders.add(`${provider}:${alias}`);
  const Provider = providers[provider];
  if (!Provider) throw new Error("unknown provider");

  // Check for backend config
  const backendConfig = getProviderConfig(provider, alias);

  // Merge: backend config + credential alias
  const config = backendConfig
    ? {
        ...backendConfig,
        credential: alias,
      }
    : alias;

  return new Provider(config) as ProviderInstance<T>;
}
