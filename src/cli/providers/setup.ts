import { intro, outro, text, password, confirm, select, multiselect, spinner } from '@clack/prompts';
import { fetchProviderType, createProvider, ProviderSetupStep, fetchNamespaces } from '../api/apiMethods';
import { UsedProvider } from './availability';
import { logger } from '../utils/logger';

export async function setupUnavailableProviders(
  unavailableProviders: UsedProvider[]
): Promise<void> {
  if (unavailableProviders.length === 0) {
    return;
  }

  intro('🔌 Provider Setup Required');

  console.log(`Found ${unavailableProviders.length} unavailable provider(s) that need to be configured:`);
  unavailableProviders.forEach(provider => {
    console.log(`  • ${provider.type}${provider.alias ? ` (alias: ${provider.alias})` : ''}`);
  });

  const shouldContinue = await confirm({
    message: 'Would you like to set up these providers now?',
    initialValue: true,
  });

  if (!shouldContinue) {
    outro('❌ Provider setup cancelled. Your code may not work correctly.');
    return;
  }

  // Get available namespaces
  const s = spinner();
  s.start('Fetching namespaces...');
  const namespaces = await fetchNamespaces();
  s.stop('✅ Namespaces loaded');

  let selectedNamespaceId: string;

  if (namespaces.length === 1) {
    selectedNamespaceId = namespaces[0].id;
    console.log(`Using namespace: ${namespaces[0].display_name}`);
  } else {
    const namespaceChoice = await select({
      message: 'Select a namespace for these providers:',
      options: namespaces.map(ns => ({
        value: ns.id,
        label: ns.display_name || ns.name,
        hint: ns.name
      }))
    });
    selectedNamespaceId = namespaceChoice as string;
  }

  // Set up each unavailable provider
  for (const provider of unavailableProviders) {
    await setupSingleProvider(provider, selectedNamespaceId);
  }

  outro('✅ All providers have been configured successfully!');
}

async function setupSingleProvider(
  provider: UsedProvider,
  namespaceId: string
): Promise<void> {
  console.log(`\n🔧 Setting up ${provider.type}${provider.alias ? ` (alias: ${provider.alias})` : ''}...`);

  try {
    // Fetch provider type configuration
    const s = spinner();
    s.start(`Fetching ${provider.type} configuration...`);
    const providerType = await fetchProviderType(provider.type);
    s.stop(`✅ ${provider.type} configuration loaded`);

    // Collect configuration values
    const config: Record<string, any> = {};

    for (const step of providerType.setup_steps) {
      const value = await promptForSetupStep(step);
      config[step.field_name] = value;
    }

    // Create the provider
    const createSpinner = spinner();
    createSpinner.start('Creating provider...');

    await createProvider({
      namespace_id: namespaceId,
      type: provider.type,
      alias: provider.alias || provider.type,
      config
    });

    createSpinner.stop(`✅ ${provider.type} provider created successfully`);

  } catch (error) {
    logger.error(`Failed to setup ${provider.type}`, error);
    throw error;
  }
}

async function promptForSetupStep(step: ProviderSetupStep): Promise<string> {
  const basePrompt = {
    message: step.label,
    placeholder: step.placeholder,
    defaultValue: step.default_value,
    validate: (value: string) => {
      if (step.required && (!value || value.trim() === '')) {
        return 'This field is required';
      }
      return;
    }
  };

  // Add description as a hint if available
  if (step.description) {
    console.log(`💡 ${step.description}`);
  }

  switch (step.type) {
    case 'password':
    case 'secret':
    case 'token':
      return await password(basePrompt) as string;

    case 'text':
    case 'string':
    case 'url':
    case 'email':
    default:
      return await text(basePrompt) as string;
  }
}