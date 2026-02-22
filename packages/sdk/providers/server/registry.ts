import type { ProviderDefinition } from "../base";

// Import all server providers
import { BuiltinServerProvider } from "../builtin/server";
import { GitHubServerProvider } from "../github/server";
import { SlackServerProvider } from "../slack/server";
import { DiscordServerProvider } from "../discord/server";
import { GitLabServerProvider } from "../gitlab/server";
import { JiraServerProvider } from "../jira/server";
import { KVStoreServerProvider } from "../kvstore/server";
import { TodoistServerProvider } from "../todoist/server";
import { GoogleCalendarServerProvider } from "../google_calendar/server";
import { AIServerProvider } from "../ai/server";

/**
 * Registry of all server-side provider definitions
 * Using loose type to allow different secret types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providerRegistry: Record<string, ProviderDefinition<any>> = {
  builtin: BuiltinServerProvider,
  github: GitHubServerProvider,
  slack: SlackServerProvider,
  discord: DiscordServerProvider,
  gitlab: GitLabServerProvider,
  jira: JiraServerProvider,
  kvstore: KVStoreServerProvider,
  todoist: TodoistServerProvider,
  google_calendar: GoogleCalendarServerProvider,
  ai: AIServerProvider,
};

/**
 * Get a provider definition by type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProviderDefinition(providerType: string): ProviderDefinition<any> | undefined {
  return providerRegistry[providerType];
}

/**
 * Get all registered provider definitions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllProviderDefinitions(): Record<string, ProviderDefinition<any>> {
  return { ...providerRegistry };
}

/**
 * Get list of all registered provider types
 */
export function getProviderTypes(): string[] {
  return Object.keys(providerRegistry);
}
