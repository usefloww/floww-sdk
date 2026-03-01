import { enableTestMode, getProviderInstances } from "./state";
import { wrapActionsWithSpies } from "./spies";
import { augmentTriggersWithInvoke } from "./invoke";
import { resetAll } from "./reset";

enableTestMode();

for (const provider of getProviderInstances()) {
  if (!(provider as any)._testPatched) {
    provider.triggers = augmentTriggersWithInvoke(provider, provider.triggers);
    provider.actions = wrapActionsWithSpies(provider.actions);
    (provider as any)._testPatched = true;
  }
}

if (typeof beforeEach === "function") {
  beforeEach(() => {
    resetAll();
  });
}

export { resetAll };
