import { getProviderInstances } from "./state";

function resetProvider(provider: any): void {
  if (provider.actions) {
    for (const key of Object.keys(provider.actions)) {
      const action = provider.actions[key];
      if (action && typeof action.reset === "function") {
        action.reset();
      }
    }
  }
}

export function resetAll(...providers: any[]): void {
  const targets = providers.length > 0 ? providers : Array.from(getProviderInstances());
  for (const provider of targets) {
    resetProvider(provider);
  }
}
