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

export async function setupUnavailableProviders(
  unavailableProviders: UsedProvider[],
  namespaceId: string
): Promise<void> {
  if (unavailableProviders.length === 0) {
    return;
  }

  logger.warn(
    `${unavailableProviders.length} provider(s) need configuration`
  );
  intro("🔌 Provider Setup Required");

  const providersList = unavailableProviders
    .map(
      (provider) =>
        `  • ${provider.type}${
          provider.alias ? ` (alias: ${provider.alias})` : ""
        }`
    )
    .join("\n");

  logger.plain(
    `Found ${unavailableProviders.length} unavailable provider(s) that need to be configured:\n${providersList}`
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

  // Set up each unavailable provider
  for (const provider of unavailableProviders) {
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
    // Fetch provider type configuration
    const providerType = await logger.task(
      `Fetching ${provider.type} configuration`,
      async () => {
        return await fetchProviderType(provider.type);
      }
    );

    // Collect configuration values
    const config: Record<string, any> = {};

    for (const step of providerType.setup_steps) {
      if (step.type === "info") {
        // Display info step without collecting a value
        await displayInfoStep(step);
      } else {
        // Collect value for input steps
        const value = await promptForSetupStep(step);
        config[step.alias] = value;
      }
    }

    // Create the provider
    await logger.task("Creating provider", async () => {
      await createProvider({
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
