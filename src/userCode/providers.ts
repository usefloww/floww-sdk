import { Builtin } from "@/providers";
import { Gitlab } from "../providers/gitlab";
import { Slack } from "../providers/slack";

const _usedProviders = new Set<string>();
const _registeredTriggers = new Set<any>();

export function getUsedProviders() {
  return Array.from(_usedProviders).map((s) => {
    const [provider, alias] = s.split(":");
    return { provider, alias };
  });
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
  alias = "default",
): ProviderInstance<T> {
  _usedProviders.add(`${provider}:${alias}`);
  const Provider = providers[provider];
  if (!Provider) throw new Error("unknown provider");
  return new Provider() as ProviderInstance<T>;
}
