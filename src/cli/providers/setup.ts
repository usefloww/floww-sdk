import {
  intro,
  outro,
  text,
  confirm,
  isCancel,
  cancel,
} from "@clack/prompts";
import {
  fetchProviderType,
  createProvider,
  ProviderSetupStep,
} from "../api/apiMethods";
import { UsedProvider } from "./availability";
import { logger } from "../utils/logger";
import { SecretManager } from "../secrets/secretManager";
import { defaultApiClient } from "../api/client";

export async function setupUnavailableProviders(
  unavailableProviders: UsedProvider[],
  namespaceId: string
): Promise<void> {
  if (unavailableProviders.length === 0) {
    return;
  }

  // Separate providers into those that need setup vs auto-created
  const providersNeedingSetup: UsedProvider[] = [];
  const providersToAutoCreate: UsedProvider[] = [];

  for (const provider of unavailableProviders) {
    try {
      const providerType = await fetchProviderType(provider.type);
      if (providerType.setup_steps.length === 0) {
        providersToAutoCreate.push(provider);
      } else {
        providersNeedingSetup.push(provider);
      }
    } catch (error) {
      logger.error(`Failed to fetch provider type for ${provider.type}`, error);
      providersNeedingSetup.push(provider); // Treat as needing setup if we can't determine
    }
  }

  // Auto-create providers that don't need setup (like KVStore)
  for (const provider of providersToAutoCreate) {
    await logger.task(
      `Auto-creating ${provider.type} provider (${provider.alias})`,
      async () => {
        await createProvider({
          namespace_id: namespaceId,
          type: provider.type,
          alias: provider.alias || provider.type,
          config: {},
        });
      }
    );
  }

  // If all providers were auto-created, we're done
  if (providersNeedingSetup.length === 0) {
    return;
  }

  logger.warn(
    `${providersNeedingSetup.length} provider(s) need configuration`
  );
  intro("🔌 Provider Setup Required");

  const providersList = providersNeedingSetup
    .map(
      (provider) =>
        `  • ${provider.type}${
          provider.alias ? ` (alias: ${provider.alias})` : ""
        }`
    )
    .join("\n");

  logger.plain(
    `Found ${providersNeedingSetup.length} unavailable provider(s) that need to be configured:\n${providersList}`
  );

  const shouldContinue = await confirm({
    message: "Would you like to set up these providers now?",
    initialValue: true,
  });

  if (isCancel(shouldContinue)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (!shouldContinue) {
    outro("❌ Provider setup cancelled. Your code may not work correctly.");
    return;
  }

  // Use the workflow's namespace (no prompt needed)
  logger.plain(`Using workflow namespace: ${namespaceId}`);

  // Set up each provider that needs configuration
  for (const provider of providersNeedingSetup) {
    await setupSingleProvider(provider, namespaceId);
  }

  outro("✅ All providers have been configured successfully!");
}

async function setupSingleProvider(
  provider: UsedProvider,
  namespaceId: string
): Promise<void> {
  logger.plain(
    `\n🔧 Setting up ${provider.type}${
      provider.alias ? ` (alias: ${provider.alias})` : ""
    }`
  );

  try {
    // Check if provider has embedded secretDefinitions (e.g., Secret provider)
    if (provider.secretDefinitions && provider.secretDefinitions.length > 0) {
      await setupSecretProvider(provider, namespaceId);
      return;
    }

    // Fetch provider type configuration from backend
    const providerType = await logger.task(
      `Fetching ${provider.type} configuration`,
      async () => {
        return await fetchProviderType(provider.type);
      }
    );

    // Collect configuration values
    const config: Record<string, any> = {};
    const webhookSteps: ProviderSetupStep[] = [];

    for (const step of providerType.setup_steps) {
      if (step.type === "info") {
        // Display info step without collecting a value
        await displayInfoStep(step);
      } else if (step.type === "webhook") {
        // Store webhook steps to display
        webhookSteps.push(step);
        // Include default webhook URL in config if provided
        if (step.default) {
          config[step.alias] = step.default;
        }
      } else {
        // Collect value for input steps
        const value = await promptForSetupStep(step);
        config[step.alias] = value;
      }
    }

    // Display pre-generated webhook URLs if any
    if (webhookSteps.length > 0 && webhookSteps.some((s) => s.default)) {
      logger.plain("\n📋 Webhook URLs for this provider:\n");
      for (const webhookStep of webhookSteps) {
        if (webhookStep.default) {
          logger.plain(`🔗 ${webhookStep.title}:`);
          if (webhookStep.description) {
            logger.plain(`   ${webhookStep.description}`);
          }
          logger.plain(`   ${webhookStep.default}`);
          logger.plain("");
        }
      }
    }

    // Create the provider
    const createdProvider = await logger.task("Creating provider", async () => {
      return await createProvider({
        namespace_id: namespaceId,
        type: provider.type,
        alias: provider.alias || provider.type,
        config,
      });
    });

    logger.success(`${provider.type} provider created successfully`);
  } catch (error) {
    logger.error(`Failed to setup ${provider.type}`, error);
    throw error;
  }
}

async function setupSecretProvider(
  provider: UsedProvider,
  namespaceId: string
): Promise<void> {
  const secretManager = new SecretManager(defaultApiClient(), namespaceId);
  const alias = provider.alias || "default";

  const secrets: Record<string, any> = {};

  // Prompt for each secret field
  for (const def of provider.secretDefinitions!) {
    console.log(`[Setup Debug] Field: ${def.key}, dataType: ${def.dataType}, type: ${def.type}`);
    const value = await text({
      message: def.label,
      placeholder: def.type === "password" ? "••••••••" : `Enter ${def.key}`,
      validate: (input: string) => {
        if (def.required && (!input || input.trim() === "")) {
          return `${def.label} is required`;
        }

        // Validate based on dataType
        if (input && input.trim()) {
          if (def.dataType === 'number') {
            const num = Number(input);
            if (isNaN(num)) {
              return `${def.label} must be a valid number`;
            }
          } else if (def.dataType === 'boolean') {
            if (!['true', 'false', '1', '0'].includes(input.toLowerCase())) {
              return `${def.label} must be true/false or 1/0`;
            }
          }
        }

        return;
      },
    });

    if (isCancel(value)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    // Coerce value based on dataType
    console.log(`[Setup Debug] Raw value for ${def.key}: "${value}" (type: ${typeof value})`);
    if (def.dataType === 'number') {
      const coerced = Number(value);
      console.log(`[Setup Debug] Coercing to number: ${coerced}`);
      secrets[def.key] = coerced;
    } else if (def.dataType === 'boolean') {
      secrets[def.key] = value.toLowerCase() === 'true' || value === '1';
    } else {
      secrets[def.key] = value;
    }
    console.log(`[Setup Debug] Final value for ${def.key}:`, secrets[def.key]);
  }

  console.log(`[Setup Debug] All secrets before saving:`, secrets);

  // Save secrets as JSON to backend
  await secretManager.setProviderSecrets(provider.type, alias, secrets);

  // Create provider entry (with empty config since secrets are stored separately)
  await logger.task("Creating provider", async () => {
    await createProvider({
      namespace_id: namespaceId,
      type: provider.type,
      alias: alias,
      config: {},
    });
  });

  logger.success(`${provider.type} secrets configured successfully`);
}

async function displayInfoStep(step: ProviderSetupStep): Promise<void> {
  // Display the title
  logger.plain(`\nℹ️  ${step.title}`);

  // Display the message
  if (step.message) {
    logger.plain(step.message);
  }

  // Display action link if provided
  if (step.action_url) {
    const actionText = step.action_text || "Open link";
    logger.plain(`\n🔗 ${actionText}: ${step.action_url}`);
  }

  // Prompt user to continue
  const shouldContinue = await confirm({
    message: "Continue?",
    initialValue: true,
  });

  if (isCancel(shouldContinue) || !shouldContinue) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

async function promptForSetupStep(step: ProviderSetupStep): Promise<string> {
  // Build message with optional description hint
  let message = step.title;
  if (step.description && step.description !== step.title) {
    message += ` (${step.description})`;
  }

  step.placeholder = step.placeholder || "key-xxxx";

  const basePrompt = {
    message,
    placeholder: step.placeholder,
    initialValue: step.default,
    validate: (value: string) => {
      if (step.required && (!value || value.trim() === "")) {
        return "This field is required";
      }
      return;
    },
  };

  let result: string | symbol;

  switch (step.type) {
    case "password":
    case "secret":
    case "token":
      result = await text(basePrompt);
      break;

    case "text":
    case "string":
    case "url":
    case "email":
    default:
      result = await text(basePrompt);
      break;
  }

  if (isCancel(result)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return result as string;
}
