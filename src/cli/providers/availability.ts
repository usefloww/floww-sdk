import { fetchProviders, Provider } from "../api/apiMethods";
import { logger } from "../utils/logger";
import { SecretDefinition } from "../../common";

export interface UsedProvider {
  type: string;
  alias?: string;
  secretDefinitions?: SecretDefinition[];
}

export interface ProviderAvailabilityResult {
  available: UsedProvider[];
  unavailable: UsedProvider[];
  existingProviders: Provider[];
}

export async function checkProviderAvailability(
  usedProviders: UsedProvider[],
): Promise<ProviderAvailabilityResult> {
  try {
    // Fetch existing providers from API
    const existingProviders = await fetchProviders();

    // Create a map of existing providers by type:alias
    const existingMap = new Map<string, Provider>();
    existingProviders.forEach((provider) => {
      const key = `${provider.type}:${provider.alias}`;
      existingMap.set(key, provider);
    });

    const available: UsedProvider[] = [];
    const unavailable: UsedProvider[] = [];

    // Check each used provider
    for (const used of usedProviders) {
      const key = `${used.type}:${used.alias || "default"}`;
      const providerExists = existingMap.has(key);

      // If provider has secret definitions, also check if secrets are configured
      if (providerExists && used.secretDefinitions && used.secretDefinitions.length > 0) {
        const { SecretManager } = await import("../secrets/secretManager");
        const { defaultApiClient } = await import("../api/client");
        const existingProvider = existingMap.get(key)!;

        const manager = new SecretManager(defaultApiClient(), existingProvider.namespace_id);
        const secrets = await manager.getProviderSecrets(used.type, used.alias || "default");

        // Check if secrets exist and have the required keys
        if (secrets && used.secretDefinitions.every(def => secrets[def.key] !== undefined)) {
          available.push(used);
        } else {
          unavailable.push(used);
        }
      } else if (providerExists) {
        available.push(used);
      } else {
        unavailable.push(used);
      }
    }

    return {
      available,
      unavailable,
      existingProviders,
    };
  } catch (error) {
    logger.error("Failed to check provider availability", error);
    throw error;
  }
}

export function getUnavailableProviderTypes(
  unavailable: UsedProvider[],
): string[] {
  return [...new Set(unavailable.map((p) => p.type))];
}
