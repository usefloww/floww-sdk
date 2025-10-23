import { detectProvidersInProject } from './detection';
import { checkProviderAvailability } from './availability';
import { setupMissingProviders } from './setup';
import { manageProviders } from './management';
import { logger } from '../utils/logger';

export { manageProviders };

export interface ProviderEnsuranceResult {
  success: boolean;
  detectedProviders: number;
  missingProviders: number;
  setupCompleted: boolean;
}

/**
 * Main workflow: Detect providers in code, check availability, and setup missing ones
 */
export async function ensureProvidersAvailable(
  filePath: string,
  entryPoint: string = 'triggers'
): Promise<ProviderEnsuranceResult> {
  try {
    // 1. Detect providers in the code
    console.log('🔍 Detecting providers in your code...');
    const detection = await detectProvidersInProject(filePath, entryPoint);

    if (detection.providers.length === 0) {
      console.log('✅ No providers detected - nothing to configure');
      return {
        success: true,
        detectedProviders: 0,
        missingProviders: 0,
        setupCompleted: false
      };
    }

    console.log(`📋 Found ${detection.providers.length} provider(s):`);
    detection.providers.forEach(p => {
      console.log(`  • ${p.type}${p.alias ? ` (alias: ${p.alias})` : ''}`);
    });

    // 2. Check which providers are available
    console.log('\n🔍 Checking provider availability...');
    const availability = await checkProviderAvailability(detection.providers);

    if (availability.available.length > 0) {
      console.log(`✅ ${availability.available.length} provider(s) already configured`);
    }

    if (availability.missing.length === 0) {
      console.log('🎉 All providers are already configured!');
      return {
        success: true,
        detectedProviders: detection.providers.length,
        missingProviders: 0,
        setupCompleted: false
      };
    }

    // 3. Setup missing providers
    console.log(`\n⚠️ ${availability.missing.length} provider(s) need configuration`);
    await setupMissingProviders(availability.missing);

    return {
      success: true,
      detectedProviders: detection.providers.length,
      missingProviders: availability.missing.length,
      setupCompleted: true
    };

  } catch (error) {
    logger.error('Provider setup failed', error);
    return {
      success: false,
      detectedProviders: 0,
      missingProviders: 0,
      setupCompleted: false
    };
  }
}

/**
 * Quick check without interactive setup - useful for CI/deploy scenarios
 */
export async function validateProvidersAvailable(
  filePath: string,
  entryPoint: string = 'triggers'
): Promise<{ valid: boolean; missing: string[] }> {
  try {
    const detection = await detectProvidersInProject(filePath, entryPoint);

    if (detection.providers.length === 0) {
      return { valid: true, missing: [] };
    }

    const availability = await checkProviderAvailability(detection.providers);

    if (availability.missing.length === 0) {
      return { valid: true, missing: [] };
    }

    const missingTypes = [...new Set(availability.missing.map(p => p.type))];
    return { valid: false, missing: missingTypes };

  } catch (error) {
    logger.error('Provider validation failed', error);
    return { valid: false, missing: [] };
  }
}