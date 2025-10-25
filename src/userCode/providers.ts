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

export async function getProvider<T extends "gitlab" | "slack">(
  provider: T,
  alias: string = "default"
): Promise<T extends "gitlab" ? Gitlab : Slack> {
  _usedProviders.add(`${provider}:${alias}`);

  switch (provider) {
    case "gitlab":
      return new Gitlab() as any;
    case "slack":
      return new Slack() as any;
  }
  throw new Error("unknown provider");
}
