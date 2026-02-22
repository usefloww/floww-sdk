// Server-side provider exports
// These are used by the dashboard server for trigger lifecycle and webhook processing

// Re-export types from base
export type {
  SetupStep,
  SetupStepValue,
  SetupStepSecret,
  SetupStepOAuth,
  SetupStepWebhook,
  SetupStepChoice,
  SetupStepShowWhen,
  TriggerCreateContext,
  TriggerDestroyContext,
  TriggerRefreshContext,
  TriggerLifecycle,
  WebhookRequest,
  WebhookValidationResult,
  TriggerInfo,
  WebhookMatch,
  WebhookProcessor,
  TriggerDefinition,
  ProviderDefinition,
} from "../base";

// Export registry
export {
  getProviderDefinition,
  getAllProviderDefinitions,
  getProviderTypes,
} from "./registry";

// Export individual server providers
export { BuiltinServerProvider } from "../builtin/server";
export { GitHubServerProvider } from "../github/server";
export { SlackServerProvider } from "../slack/server";
export { DiscordServerProvider } from "../discord/server";
export { GitLabServerProvider } from "../gitlab/server";
export { JiraServerProvider } from "../jira/server";
export { AIServerProvider } from "../ai/server";
