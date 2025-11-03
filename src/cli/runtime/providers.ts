import {
  checkProviderAvailability,
  ProviderAvailabilityResult,
  UsedProvider as BaseUsedProvider,
} from "../providers/availability";
import { setupUnavailableProviders } from "../providers/setup";
import { logger } from "../utils/logger";

// Re-export for convenience
export type UsedProvider = BaseUsedProvider;
export type { ProviderAvailabilityResult };

export interface ValidateProvidersOptions {
  interactive: boolean;
  namespaceId: string;
}

/**
 * Verify that all used providers are set up.
 *
 * This function checks if all providers used in user code are configured
 * in the backend. In interactive mode (dev), prompts user to setup missing
 * providers. In non-interactive mode (deploy), throws error if missing.
 *
 * @param usedProviders - List of providers referenced in user code
 * @param options - Configuration for validation behavior
 * @throws {Error} In non-interactive mode, if providers are missing
 */
export async function validateProviders(
  usedProviders: UsedProvider[],
  options: ValidateProvidersOptions,
): Promise<void> {
  if (usedProviders.length === 0) {
    logger.debugInfo("No providers used - nothing to configure");
    return;
  }

  logger.debugInfo(
    `Found ${usedProviders.length} used provider(s):`,
    usedProviders.map((p) => ({ type: p.type, alias: p.alias || "default" })),
  );

  // Check availability
  const availability = await checkProviderAvailability(usedProviders);

  if (
    availability &&
    availability.available &&
    availability.available.length > 0
  ) {
    logger.debugInfo(
      `${availability.available.length} provider(s) already configured`,
    );
  }

  // Handle unavailable providers
  if (
    availability &&
    availability.unavailable &&
    availability.unavailable.length > 0
  ) {
    if (!options.interactive) {
      // Non-interactive mode: fail fast
      const missingTypes = [
        ...new Set(availability.unavailable.map((p) => p.type)),
      ];
      throw new Error(
        `Missing providers: ${missingTypes.join(", ")}. Run "floww dev" to set up providers interactively.`,
      );
    }

    // Interactive mode: prompt user
    console.log(
      `⚠️  ${availability.unavailable.length} provider(s) need configuration`,
    );
    await setupUnavailableProviders(availability.unavailable, options.namespaceId);

    logger.debugInfo("All providers have been configured!");
  } else {
    logger.debugInfo("All providers are already configured!");
  }
}

/**
 * Non-interactive check for deploy mode
 *
 * Checks provider availability without any user interaction.
 * Used in deployment pipeline to validate configuration before deploying.
 *
 * @param usedProviders - List of providers referenced in user code
 * @returns Availability result with available/unavailable providers
 */
export async function checkProviders(
  usedProviders: UsedProvider[],
): Promise<ProviderAvailabilityResult> {
  if (usedProviders.length === 0) {
    return {
      available: [],
      unavailable: [],
      existingProviders: [],
    };
  }

  return await checkProviderAvailability(usedProviders);
}
