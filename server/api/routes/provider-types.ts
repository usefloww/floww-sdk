/**
 * Provider Types Routes
 *
 * GET /provider-types - List all provider types
 * GET /provider-types/:providerType - Get provider type metadata
 */

import { get, json, errorResponse } from '~/server/api/router';
import {
  getAllProviderDefinitions,
  getProviderDefinition,
} from 'floww/providers/server';
import type { SetupStep } from 'floww/providers/server';
import { INTERNAL_PROVIDERS } from 'floww/providers/constants';

// Backend metadata for display purposes (not in SDK)
const PROVIDER_METADATA: Record<string, { name: string; description: string }> = {
  builtin: {
    name: 'Built-in',
    description: 'Webhooks, cron schedules, and manual triggers',
  },
  discord: {
    name: 'Discord',
    description: 'Discord bot for messages, reactions, and member events',
  },
  github: {
    name: 'GitHub',
    description: 'GitHub repositories, issues, and pull requests',
  },
  gitlab: {
    name: 'GitLab',
    description: 'GitLab repositories and merge requests',
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Google Calendar events and scheduling',
  },
  jira: {
    name: 'Jira',
    description: 'Jira Cloud issues and comments',
  },
  kvstore: {
    name: 'Key-Value Store',
    description: 'Persistent key-value storage for workflows',
  },
  slack: {
    name: 'Slack',
    description: 'Slack messages and reactions',
  },
  todoist: {
    name: 'Todoist',
    description: 'Todoist task management',
  },
  ai: {
    name: 'AI',
    description: 'AI language models (OpenAI, Anthropic, Google)',
  },
};

// List all provider types (from SDK registry + backend metadata)
get('/provider-types', async ({ user }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const allDefs = getAllProviderDefinitions();

  return json({
    results: Object.entries(allDefs)
      .filter(([type]) => !INTERNAL_PROVIDERS.includes(type as any))
      .map(([type, def]) => {
        const meta = PROVIDER_METADATA[type] ?? { name: type, description: '' };
        return {
          type,
          name: meta.name,
          description: meta.description,
          triggerTypes: Object.keys(def.triggerDefinitions),
        };
      }),
  });
});

// Transform SDK setup steps to frontend format
function transformSetupSteps(steps: SetupStep[] | undefined) {
  if (!steps) return [];
  
  return steps.map((step: SetupStep) => {
    if (step.type === 'oauth') {
      // SDK uses 'provider', frontend expects 'providerName' and 'alias'
      return {
        type: 'oauth' as const,
        title: `Connect ${step.provider.charAt(0).toUpperCase() + step.provider.slice(1)} Account`,
        alias: step.provider, // Use provider name as alias
        providerName: step.provider,
        scopes: step.scopes,
        description: step.description,
        required: true,
      };
    }
    
    if (step.type === 'value' || step.type === 'secret') {
      // SDK uses 'key' and 'label', frontend expects 'alias' and 'title'
      return {
        type: step.type,
        title: step.label,
        alias: step.key,
        description: step.description,
        required: step.required,
        placeholder: step.placeholder,
        showWhen: step.showWhen,
      };
    }

    if (step.type === 'choice') {
      return {
        type: 'choice' as const,
        title: step.label,
        alias: step.key,
        description: step.description,
        required: step.required,
        options: step.options,
      };
    }

    if (step.type === 'webhook') {
      return {
        type: 'webhook' as const,
        title: step.label,
        alias: step.key,
        description: step.description,
      };
    }

    return step;
  });
}

// Get single provider type metadata
get('/provider-types/:providerType', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerType } = params;

  // Internal providers are not accessible via this API
  if (INTERNAL_PROVIDERS.includes(providerType as any)) {
    return errorResponse(`Provider type not found: ${providerType}`, 404);
  }

  const def = getProviderDefinition(providerType);

  if (!def) {
    return errorResponse(`Unknown provider type: ${providerType}`, 404);
  }

  const meta = PROVIDER_METADATA[providerType] ?? { name: providerType, description: '' };

  return json({
    providerType,
    name: meta.name,
    description: meta.description,
    setupSteps: transformSetupSteps(def.setupSteps),
    triggerTypes: Object.keys(def.triggerDefinitions),
  });
});
