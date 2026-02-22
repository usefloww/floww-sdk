import type { ProviderDefinition, SetupStep } from "../base";

interface AISecrets {
  apiKey: string;
}

const setupSteps: SetupStep[] = [
  {
    type: "choice",
    key: "provider",
    label: "AI Provider",
    required: true,
    options: ["openai", "anthropic", "google"],
  },
  {
    type: "secret",
    key: "apiKey",
    label: "API Key",
    description: "Your AI provider API key",
    required: true,
  },
  {
    type: "value",
    key: "baseURL",
    label: "Base URL",
    description: "Custom API base URL (optional, for proxies or compatible APIs)",
    required: false,
  },
  {
    type: "value",
    key: "organization",
    label: "Organization",
    description: "OpenAI organization ID",
    required: false,
    showWhen: { field: "provider", value: "openai" },
  },
  {
    type: "value",
    key: "project",
    label: "Project",
    description: "OpenAI project ID",
    required: false,
    showWhen: { field: "provider", value: "openai" },
  },
];

export const AIServerProvider: ProviderDefinition<AISecrets> = {
  providerType: "ai",
  setupSteps,
  triggerDefinitions: {},
};
