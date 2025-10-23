import { intro, outro, select, confirm, text, spinner } from '@clack/prompts';
import {
  fetchProviders,
  updateProvider,
  deleteProvider,
  Provider
} from '../api/apiMethods';
import { logger } from '../utils/logger';

export async function manageProviders(): Promise<void> {
  intro('🔌 Provider Management');

  try {
    // Fetch existing providers
    const s = spinner();
    s.start('Loading providers...');
    const providers = await fetchProviders();
    s.stop('✅ Providers loaded');

    if (providers.length === 0) {
      outro('No providers found in your namespace.');
      return;
    }

    // Show provider management menu
    await showProviderManagementMenu(providers);

  } catch (error) {
    logger.error('Failed to load providers', error);
    outro('Failed to manage providers');
  }
}

async function showProviderManagementMenu(providers: Provider[]): Promise<void> {
  while (true) {
    console.log('\n📋 Current Providers:');
    providers.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.type} (alias: ${provider.alias})`);
    });

    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'view', label: '👀 View provider details' },
        { value: 'edit', label: '✏️ Edit provider' },
        { value: 'delete', label: '🗑️ Delete provider' },
        { value: 'exit', label: '🚪 Exit' }
      ]
    });

    if (action === 'exit') {
      outro('👋 Goodbye!');
      break;
    }

    const provider = await selectProvider(providers);
    if (!provider) continue;

    switch (action) {
      case 'view':
        await viewProvider(provider);
        break;
      case 'edit':
        await editProvider(provider);
        // Refresh providers list
        const s = spinner();
        s.start('Refreshing providers...');
        providers = await fetchProviders();
        s.stop('✅ Providers refreshed');
        break;
      case 'delete':
        const deleted = await deleteProviderPrompt(provider);
        if (deleted) {
          // Refresh providers list
          const s = spinner();
          s.start('Refreshing providers...');
          providers = await fetchProviders();
          s.stop('✅ Providers refreshed');
        }
        break;
    }

    if (providers.length === 0) {
      outro('No providers remaining.');
      break;
    }
  }
}

async function selectProvider(providers: Provider[]): Promise<Provider | null> {
  const choice = await select({
    message: 'Select a provider:',
    options: providers.map(provider => ({
      value: provider.id,
      label: `${provider.type} (${provider.alias})`,
      hint: `ID: ${provider.id}`
    }))
  });

  return providers.find(p => p.id === choice) || null;
}

async function viewProvider(provider: Provider): Promise<void> {
  console.log('\n📄 Provider Details:');
  console.log(`  Type: ${provider.type}`);
  console.log(`  Alias: ${provider.alias}`);
  console.log(`  ID: ${provider.id}`);
  console.log(`  Namespace: ${provider.namespace_id}`);

  console.log('  Configuration:');
  Object.entries(provider.config).forEach(([key, value]) => {
    // Hide sensitive values
    const displayValue = (key.toLowerCase().includes('password') ||
                         key.toLowerCase().includes('secret') ||
                         key.toLowerCase().includes('token'))
                         ? '***hidden***'
                         : value;
    console.log(`    ${key}: ${displayValue}`);
  });

  await confirm({
    message: 'Press Enter to continue...',
    initialValue: true
  });
}

async function editProvider(provider: Provider): Promise<void> {
  console.log(`\n✏️ Editing ${provider.type} (${provider.alias})`);

  const newAlias = await text({
    message: 'Provider alias:',
    defaultValue: provider.alias,
    validate: (value) => {
      if (!value || value.trim() === '') {
        return 'Alias is required';
      }
    }
  });

  console.log('\n🔧 Configuration (leave empty to keep current value):');
  const newConfig: Record<string, any> = { ...provider.config };

  for (const [key, currentValue] of Object.entries(provider.config)) {
    const isSensitive = key.toLowerCase().includes('password') ||
                       key.toLowerCase().includes('secret') ||
                       key.toLowerCase().includes('token');

    const newValue = await text({
      message: `${key}:`,
      placeholder: isSensitive ? 'Enter new value or leave empty to keep current' : currentValue?.toString(),
      defaultValue: undefined // Don't show current value for sensitive fields
    });

    if (newValue && newValue.trim() !== '') {
      newConfig[key] = newValue;
    }
  }

  const shouldUpdate = await confirm({
    message: 'Save changes?',
    initialValue: true
  });

  if (shouldUpdate) {
    const s = spinner();
    s.start('Updating provider...');

    try {
      await updateProvider(provider.id, {
        alias: newAlias as string,
        config: newConfig
      });
      s.stop('✅ Provider updated successfully');
    } catch (error) {
      s.stop('❌ Failed to update provider');
      logger.error('Failed to update provider', error);
    }
  }
}

async function deleteProviderPrompt(provider: Provider): Promise<boolean> {
  console.log(`\n🗑️ Delete ${provider.type} (${provider.alias})?`);
  console.log('⚠️ This action cannot be undone.');

  const shouldDelete = await confirm({
    message: 'Are you sure you want to delete this provider?',
    initialValue: false
  });

  if (shouldDelete) {
    const s = spinner();
    s.start('Deleting provider...');

    try {
      await deleteProvider(provider.id);
      s.stop('✅ Provider deleted successfully');
      return true;
    } catch (error) {
      s.stop('❌ Failed to delete provider');
      logger.error('Failed to delete provider', error);
      return false;
    }
  }

  return false;
}