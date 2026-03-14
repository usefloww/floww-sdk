import { fetchProviders, fetchProviderById, Provider } from "../api/apiMethods";
import { logger } from "../utils/logger";
import { SecretDefinition } from "../../common";
import { ProviderMappings } from "../config/projectConfig";

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

/**
 * Check provider availability using the legacy type:alias lookup.
 */
export async function checkProviderAvailability(
  usedProviders: UsedProvider[],
  providerMappings?: ProviderMappings,
): Promise<ProviderAvailabilityResult> {
  // If we have provider mappings, use ID-based checking
  if (providerMappings && Object.keys(providerMappings).length > 0) {
    return await checkProviderAvailabilityByMapping(usedProviders, providerMappings);
  }

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
      // Providers without secret definitions don't need backend registration
      if (!used.secretDefinitions || used.secretDefinitions.length === 0) {
        available.push(used);
        continue;
      }

      const key = `${used.type}:${used.alias || "default"}`;
      const providerExists = existingMap.has(key);

      // If provider has secret definitions, also check if secrets are configured
      if (providerExists && used.secretDefinitions && used.secretDefinitions.length > 0) {
        const { SecretManager } = await import("../secrets/secretManager");
        const { defaultApiClient } = await import("../api/client");
        const existingProvider = existingMap.get(key)!;

        const manager = new SecretManager(defaultApiClient(), existingProvider.namespaceId);
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

/**
 * Check provider availability using ID-based mapping from floww.yaml.
 * Instead of matching by type:alias, looks up providers by their UUID.
 */
async function checkProviderAvailabilityByMapping(
  usedProviders: UsedProvider[],
  providerMappings: ProviderMappings,
): Promise<ProviderAvailabilityResult> {
  try {
    const available: UsedProvider[] = [];
    const unavailable: UsedProvider[] = [];
    const resolvedProviders: Provider[] = [];

    for (const used of usedProviders) {
      const alias = used.alias || "default";
      const mappedId = providerMappings[used.type]?.[alias];

      if (!mappedId) {
        // No mapping exists for this provider - mark as unavailable
        unavailable.push(used);
        continue;
      }

      try {
        // Verify the provider exists by fetching it by ID
        const provider = await fetchProviderById(mappedId);
        resolvedProviders.push(provider);

        // If provider has secret definitions, check if secrets are configured
        if (used.secretDefinitions && used.secretDefinitions.length > 0) {
          const { SecretManager } = await import("../secrets/secretManager");
          const { defaultApiClient } = await import("../api/client");

          const manager = new SecretManager(defaultApiClient(), provider.namespaceId);
          const secrets = await manager.getProviderSecrets(provider.type, provider.alias);

          if (secrets && used.secretDefinitions.every(def => secrets[def.key] !== undefined)) {
            available.push(used);
          } else {
            unavailable.push(used);
          }
        } else {
          available.push(used);
        }
      } catch {
        // Provider not found by ID - mark as unavailable
        logger.warn(`Provider ID ${mappedId} (${used.type}:${alias}) not found`);
        unavailable.push(used);
      }
    }

    return {
      available,
      unavailable,
      existingProviders: resolvedProviders,
    };
  } catch (error) {
    logger.error("Failed to check provider availability by mapping", error);
    throw error;
  }
}

export function getUnavailableProviderTypes(
  unavailable: UsedProvider[],
): string[] {
  return [...new Set(unavailable.map((p) => p.type))];
}
