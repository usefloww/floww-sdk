import { SecretDefinition } from "../common";

type TrackedProvider = {
  type: string;
  alias: string;
  secretDefinitions?: SecretDefinition[];
};

const _usedProviders = new Map<string, TrackedProvider>();
const _registeredTriggers = new Set<any>();
const _providerConfigs: Map<string, Record<string, any>> = new Map();

export type ProviderMetadata = {
  type: string;
  alias: string;
  triggerType: string;
  input: Record<string, any>;
};

export function trackProviderUsage(
  providerType: string,
  alias: string,
  secretDefinitions?: SecretDefinition[]
): void {
  const key = `${providerType}:${alias}`;
  _usedProviders.set(key, { type: providerType, alias, secretDefinitions });
}

export function getUsedProviders() {
  return Array.from(_usedProviders.values());
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

export function registerTrigger(trigger: any, providerMeta?: ProviderMetadata) {
  const enrichedTrigger = providerMeta
    ? { ...trigger, _providerMeta: providerMeta }
    : trigger;
  _registeredTriggers.add(enrichedTrigger);
  return enrichedTrigger;
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
