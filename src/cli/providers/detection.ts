import { executeUserProjectWithProviderDetection, getUserProject } from '../../codeExecution/index';
import { DetectedProvider } from './instrumentation';
import { logger } from '../utils/logger';

export interface ProviderDetectionResult {
  providers: DetectedProvider[];
  executionResult: any;
}

export async function detectProvidersInProject(
  filePath: string,
  entryPoint: string = 'triggers'
): Promise<ProviderDetectionResult> {
  try {
    // Get project files
    const project = await getUserProject(filePath, entryPoint);

    // Execute with provider detection
    const { result, detectedProviders } = await executeUserProjectWithProviderDetection(project);

    return {
      providers: detectedProviders,
      executionResult: result
    };
  } catch (error) {
    logger.error('Provider detection failed', error);
    throw error;
  }
}

export function extractProviderTypes(providers: DetectedProvider[]): string[] {
  return [...new Set(providers.map(p => p.type))];
}

export function getProvidersByType(providers: DetectedProvider[], type: string): DetectedProvider[] {
  return providers.filter(p => p.type === type);
}