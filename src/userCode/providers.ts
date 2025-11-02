const _usedProviders = new Set<string>();
const _registeredTriggers = new Set<any>();
const _providerConfigs: Map<string, Record<string, any>> = new Map();

export type ProviderMetadata = {
  type: string;
  alias: string;
  triggerType: string;
  input: Record<string, any>;
};

export function trackProviderUsage(providerType: string, alias: string): void {
  _usedProviders.add(`${providerType}:${alias}`);
}

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
