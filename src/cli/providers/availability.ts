import { fetchProviders, Provider } from '../api/apiMethods';
import { DetectedProvider } from './instrumentation';
import { logger } from '../utils/logger';

export interface ProviderAvailabilityResult {
  available: DetectedProvider[];
  missing: DetectedProvider[];
  existingProviders: Provider[];
}

export async function checkProviderAvailability(
  detectedProviders: DetectedProvider[]
): Promise<ProviderAvailabilityResult> {
  try {
    // Fetch existing providers from API
    const existingProviders = await fetchProviders();

    // Create a map of existing providers by type and alias
    const existingMap = new Map<string, Provider>();
    existingProviders.forEach(provider => {
      existingMap.set(provider.alias, provider);
    });

    const available: DetectedProvider[] = [];
    const missing: DetectedProvider[] = [];

    // Check each detected provider
    detectedProviders.forEach(detected => {
      const key = detected.alias || detected.type;

      if (existingMap.has(key)) {
        const existing = existingMap.get(key)!;
        // Verify type matches
        if (existing.type === detected.type) {
          available.push(detected);
        } else {
          // Alias exists but type doesn't match - treat as missing
          missing.push(detected);
        }
      } else {
        missing.push(detected);
      }
    });

    return {
      available,
      missing,
      existingProviders
    };
  } catch (error) {
    logger.error('Failed to check provider availability', error);
    throw error;
  }
}

export function getMissingProviderTypes(missing: DetectedProvider[]): string[] {
  return [...new Set(missing.map(p => p.type))];
}