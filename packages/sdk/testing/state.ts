let _testMode = false;
const _providerInstances = new Set<any>();

export function enableTestMode(): void {
  _testMode = true;
}

export function isTestMode(): boolean {
  return _testMode;
}

export function trackProviderInstance(provider: any): void {
  _providerInstances.add(provider);
}

export function getProviderInstances(): Set<any> {
  return _providerInstances;
}
