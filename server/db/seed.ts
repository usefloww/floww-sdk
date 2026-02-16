/**
 * Database Seed Script
 *
 * Populates the database with realistic-looking local development fixtures
 * so you have an environment that looks like it has been used for a while.
 *
 * Usage:
 *   pnpm db:seed          — seed only if the database is empty (safe to call repeatedly)
 *   pnpm db:seed:reset    — wipe all data and re-seed from scratch
 *
 * The script is also called automatically by the migrations container on first run.
 */

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcryptjs';
import * as schema from './schema';
import { count } from 'drizzle-orm';
import { encryptSecret } from '../utils/encryption';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://admin:secret@localhost:5432/postgres';

const RESET = process.argv.includes('--reset');

// ============================================================================
// Deterministic IDs — fixed so the seed is reproducible across resets
// All IDs are valid UUID v4 format (xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx)
// ============================================================================

const IDS = {
  org: '00000001-0000-4000-8000-000000000001',
  namespace: '00000002-0000-4000-8000-000000000002',
  subscription: '00000003-0000-4000-8000-000000000003',
  users: {
    alice: '00000010-0000-4000-8000-000000000010',
    bob: '00000011-0000-4000-8000-000000000011',
    charlie: '00000012-0000-4000-8000-000000000012',
  },
  orgMembers: {
    alice: '00000020-0000-4000-8000-000000000020',
    bob: '00000021-0000-4000-8000-000000000021',
    charlie: '00000022-0000-4000-8000-000000000022',
  },
  folders: {
    dataPipelines: '00000030-0000-4000-8000-000000000030',
    etlJobs: '00000031-0000-4000-8000-000000000031',
  },
  workflows: {
    syncCustomer: '00000040-0000-4000-8000-000000000040',
    weeklyReport: '00000041-0000-4000-8000-000000000041',
    processWebhooks: '00000042-0000-4000-8000-000000000042',
    cleanup: '00000043-0000-4000-8000-000000000043',
  },
  runtime: '00000050-0000-4000-8000-000000000050',
  runtimeHash: '00000051-0000-4000-8000-000000000051',
  deployments: {
    syncCustomer: '00000060-0000-4000-8000-000000000060',
    weeklyReport: '00000061-0000-4000-8000-000000000061',
    processWebhooks: '00000062-0000-4000-8000-000000000062',
    cleanup: '00000063-0000-4000-8000-000000000063',
  },
  providers: {
    slack: '00000070-0000-4000-8000-000000000070',
    github: '00000071-0000-4000-8000-000000000071',
    discord: '00000072-0000-4000-8000-000000000072',
    jira: '00000073-0000-4000-8000-000000000073',
    openai: '00000074-0000-4000-8000-000000000074',
  },
  incomingWebhooks: {
    slack: '00000080-0000-4000-8000-000000000080',
  },
};

async function main() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    if (RESET) {
      console.log('Resetting database...');
      await resetDatabase(client);
    } else {
      const [{ value }] = await db.select({ value: count() }).from(schema.organizations);
      if (Number(value) > 0) {
        console.log('Database already has data — skipping seed. Use --reset to force a reseed.');
        return;
      }
    }

    console.log('Seeding database with development fixtures...');
    await seed(db);
    console.log('Done!');
  } finally {
    await client.end();
  }
}

async function resetDatabase(client: postgres.Sql) {
  // TRUNCATE with CASCADE handles FK ordering automatically
  await client.unsafe(`
    TRUNCATE TABLE
      execution_logs,
      execution_history,
      recurring_tasks,
      incoming_webhooks,
      triggers,
      kv_table_permissions,
      kv_items,
      kv_tables,
      workflow_deployments,
      providers,
      secrets,
      workflows,
      workflow_folders,
      runtimes,
      billing_events,
      subscriptions,
      organization_members,
      namespaces,
      api_keys,
      refresh_tokens,
      device_codes,
      provider_access,
      organizations,
      users,
      configurations
    CASCADE
  `);
  console.log('All tables cleared.');
}

async function seed(db: PostgresJsDatabase<typeof schema>) {
  const PASSWORD_HASH = await bcrypt.hash('password', 10);

  const NOW = new Date();
  const THREE_MONTHS_AGO = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);

  function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  // --------------------------------------------------------------------------
  // 1. Users
  // --------------------------------------------------------------------------
  console.log('  users...');
  await db.insert(schema.users).values([
    {
      id: IDS.users.alice,
      userType: 'HUMAN',
      email: 'alice@example.com',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Johnson',
      passwordHash: PASSWORD_HASH,
      isAdmin: true,
    },
    {
      id: IDS.users.bob,
      userType: 'HUMAN',
      email: 'bob@example.com',
      username: 'bob',
      firstName: 'Bob',
      lastName: 'Smith',
      passwordHash: PASSWORD_HASH,
      isAdmin: false,
    },
    {
      id: IDS.users.charlie,
      userType: 'SERVICE_ACCOUNT',
      email: 'charlie-bot@example.com',
      username: 'charlie-bot',
      firstName: 'Charlie',
      lastName: 'Bot',
      isAdmin: false,
    },
  ]);

  // --------------------------------------------------------------------------
  // 2. Organization
  // --------------------------------------------------------------------------
  console.log('  organization...');
  await db.insert(schema.organizations).values({
    id: IDS.org,
    displayName: 'Acme Corp',
  });

  // --------------------------------------------------------------------------
  // 3. Organization members
  // --------------------------------------------------------------------------
  console.log('  organization members...');
  await db.insert(schema.organizationMembers).values([
    { id: IDS.orgMembers.alice, organizationId: IDS.org, userId: IDS.users.alice, role: 'OWNER' },
    { id: IDS.orgMembers.bob, organizationId: IDS.org, userId: IDS.users.bob, role: 'MEMBER' },
    {
      id: IDS.orgMembers.charlie,
      organizationId: IDS.org,
      userId: IDS.users.charlie,
      role: 'MEMBER',
    },
  ]);

  // --------------------------------------------------------------------------
  // 4. Subscription (TEAM tier to showcase a "real" account)
  // --------------------------------------------------------------------------
  console.log('  subscription...');
  await db.insert(schema.subscriptions).values({
    id: IDS.subscription,
    organizationId: IDS.org,
    tier: 'TEAM',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
  });

  // --------------------------------------------------------------------------
  // 5. Namespace (owned by the organization)
  // --------------------------------------------------------------------------
  console.log('  namespace...');
  await db.insert(schema.namespaces).values({
    id: IDS.namespace,
    organizationOwnerId: IDS.org,
  });

  // --------------------------------------------------------------------------
  // 6. Folders
  // --------------------------------------------------------------------------
  console.log('  folders...');
  await db.insert(schema.workflowFolders).values([
    {
      id: IDS.folders.dataPipelines,
      namespaceId: IDS.namespace,
      name: 'Data Pipelines',
    },
    {
      id: IDS.folders.etlJobs,
      namespaceId: IDS.namespace,
      name: 'ETL Jobs',
      parentFolderId: IDS.folders.dataPipelines,
    },
  ]);

  // --------------------------------------------------------------------------
  // 7. Workflows
  // --------------------------------------------------------------------------
  console.log('  workflows...');
  await db.insert(schema.workflows).values([
    {
      id: IDS.workflows.syncCustomer,
      namespaceId: IDS.namespace,
      name: 'Sync Customer Data',
      description: 'Syncs customer records from CRM to the data warehouse every hour.',
      createdById: IDS.users.alice,
      active: true,
      parentFolderId: IDS.folders.dataPipelines,
    },
    {
      id: IDS.workflows.weeklyReport,
      namespaceId: IDS.namespace,
      name: 'Send Weekly Report',
      description: 'Aggregates weekly metrics and emails the team a summary every Monday.',
      createdById: IDS.users.bob,
      active: true,
      parentFolderId: IDS.folders.dataPipelines,
    },
    {
      id: IDS.workflows.processWebhooks,
      namespaceId: IDS.namespace,
      name: 'Process Webhooks',
      description: 'Handles incoming webhook events from third-party services.',
      createdById: IDS.users.alice,
      active: true,
    },
    {
      id: IDS.workflows.cleanup,
      namespaceId: IDS.namespace,
      name: 'Cleanup Old Records',
      description: 'Removes staging table rows older than 90 days. Currently disabled.',
      createdById: IDS.users.charlie,
      active: false,
    },
  ]);

  // --------------------------------------------------------------------------
  // 8. Runtime
  // --------------------------------------------------------------------------
  console.log('  runtime...');
  await db.insert(schema.runtimes).values({
    id: IDS.runtime,
    configHash: IDS.runtimeHash,
    config: { image: 'floww-runtime:latest', memory_mb: 512, timeout_s: 30 },
    creationStatus: 'COMPLETED',
    creationLogs: [{ level: 'INFO', message: 'Runtime created successfully' }],
  });

  // --------------------------------------------------------------------------
  // 9. Workflow deployments
  // --------------------------------------------------------------------------
  console.log('  deployments...');
  const baseDeployment = (id: string, workflowId: string, userId: string) => ({
    id,
    workflowId,
    runtimeId: IDS.runtime,
    deployedById: userId,
    userCode: {
      files: {
        'main.ts': [
          "import { defineWorkflow } from 'floww';",
          '',
          'export default defineWorkflow(async (ctx) => {',
          "  ctx.log.info('Starting...');",
          '  // workflow logic here',
          "  return { success: true };",
          '});',
        ].join('\n'),
      },
      entrypoint: 'main.ts',
    },
  });

  await db.insert(schema.workflowDeployments).values([
    { ...baseDeployment(IDS.deployments.syncCustomer, IDS.workflows.syncCustomer, IDS.users.alice), status: 'ACTIVE' as const },
    { ...baseDeployment(IDS.deployments.weeklyReport, IDS.workflows.weeklyReport, IDS.users.bob), status: 'ACTIVE' as const },
    { ...baseDeployment(IDS.deployments.processWebhooks, IDS.workflows.processWebhooks, IDS.users.alice), status: 'ACTIVE' as const },
    { ...baseDeployment(IDS.deployments.cleanup, IDS.workflows.cleanup, IDS.users.charlie), status: 'INACTIVE' as const },
  ]);

  // --------------------------------------------------------------------------
  // 10. Execution history (~32 executions spread over the past 3 months)
  // --------------------------------------------------------------------------
  console.log('  execution history and logs...');

  const workflowExecutionConfig = [
    { workflowId: IDS.workflows.syncCustomer, deploymentId: IDS.deployments.syncCustomer },
    { workflowId: IDS.workflows.weeklyReport, deploymentId: IDS.deployments.weeklyReport },
    { workflowId: IDS.workflows.processWebhooks, deploymentId: IDS.deployments.processWebhooks },
    { workflowId: IDS.workflows.cleanup, deploymentId: IDS.deployments.cleanup },
  ];

  // Weighted status pool: ~70% COMPLETED, ~20% FAILED, ~10% TIMEOUT
  const statusPool = [
    ...Array(7).fill('COMPLETED'),
    ...Array(2).fill('FAILED'),
    ...Array(1).fill('TIMEOUT'),
  ] as Array<'COMPLETED' | 'FAILED' | 'TIMEOUT'>;

  const errorMessages = [
    'TypeError: Cannot read properties of undefined (reading "map")',
    'Error: Database connection timeout after 30000ms',
    'Error: Rate limit exceeded for external API (429)',
    'SyntaxError: Unexpected token in JSON at position 42',
    'Error: Memory limit exceeded (512MB)',
  ];

  const executions: schema.NewExecutionHistoryRecord[] = [];
  const logs: schema.NewExecutionLog[] = [];

  for (let i = 0; i < 32; i++) {
    const { workflowId, deploymentId } = workflowExecutionConfig[i % 4];
    const status = statusPool[i % statusPool.length];
    const receivedAt = randomDate(THREE_MONTHS_AGO, NOW);
    const startedAt = new Date(receivedAt.getTime() + 50 + Math.random() * 200);
    const durationMs =
      status === 'TIMEOUT' ? 30000 : Math.floor(200 + Math.random() * 9800);
    const completedAt = new Date(startedAt.getTime() + durationMs);
    const execId = crypto.randomUUID();
    const triggeredByUserId =
      i % 3 === 0 ? IDS.users.alice : i % 3 === 1 ? IDS.users.bob : null;

    executions.push({
      id: execId,
      workflowId,
      deploymentId,
      triggeredByUserId,
      status,
      receivedAt,
      startedAt,
      completedAt,
      durationMs,
      errorMessage: status !== 'COMPLETED' ? errorMessages[i % errorMessages.length] : null,
    });

    // Log entries per execution
    const logCount = status === 'COMPLETED' ? 3 + Math.floor(Math.random() * 5) : 2;
    for (let j = 0; j < logCount; j++) {
      const isLast = j === logCount - 1;
      const logLevel =
        j === 0
          ? 'INFO'
          : isLast && status === 'FAILED'
          ? 'ERROR'
          : isLast && status === 'TIMEOUT'
          ? 'WARN'
          : j % 4 === 0
          ? 'DEBUG'
          : 'INFO';

      const message =
        j === 0
          ? 'Execution started'
          : isLast && status === 'FAILED'
          ? errorMessages[i % errorMessages.length]
          : isLast && status === 'TIMEOUT'
          ? 'Execution timed out after 30s'
          : isLast
          ? 'Execution completed successfully'
          : `Processing step ${j}`;

      logs.push({
        id: crypto.randomUUID(),
        executionHistoryId: execId,
        timestamp: new Date(startedAt.getTime() + j * 150),
        logLevel: logLevel as schema.NewExecutionLog['logLevel'],
        message,
      });
    }
  }

  await db.insert(schema.executionHistory).values(executions);
  await db.insert(schema.executionLogs).values(logs);

  // --------------------------------------------------------------------------
  // 11. Providers
  // --------------------------------------------------------------------------
  console.log('  providers...');

  const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'http://localhost:3000';
  const slackWebhookPath = '/webhook/seed-slack-acme';

  await db.insert(schema.providers).values([
    {
      id: IDS.providers.slack,
      namespaceId: IDS.namespace,
      type: 'slack',
      alias: 'acme-slack',
      encryptedConfig: encryptSecret(
        JSON.stringify({
          webhook_url: `${PUBLIC_API_URL}${slackWebhookPath}`,
          bot_token: 'xoxb-placeholder-not-a-real-token',
          signing_secret: 'placeholder-not-a-real-secret',
        })
      ),
    },
    {
      id: IDS.providers.github,
      namespaceId: IDS.namespace,
      type: 'github',
      alias: 'acme-github',
      encryptedConfig: encryptSecret(
        JSON.stringify({
          token: 'ghp_placeholder-not-a-real-token',
          owner: 'acme-corp',
          repo: 'floww',
        })
      ),
    },
    {
      id: IDS.providers.discord,
      namespaceId: IDS.namespace,
      type: 'discord',
      alias: 'acme-discord',
      encryptedConfig: encryptSecret(
        JSON.stringify({
          bot_token: 'discord_placeholder-not-a-real-token',
          guild_id: '123456789012345678',
        })
      ),
    },
    {
      id: IDS.providers.jira,
      namespaceId: IDS.namespace,
      type: 'jira',
      alias: 'acme-jira',
      encryptedConfig: encryptSecret(
        JSON.stringify({
          base_url: 'https://acme.atlassian.net',
          email: 'alice@example.com',
          api_token: 'jira_placeholder-not-a-real-token',
        })
      ),
    },
    {
      id: IDS.providers.openai,
      namespaceId: IDS.namespace,
      type: 'openai',
      alias: 'acme-openai',
      encryptedConfig: encryptSecret(
        JSON.stringify({
          api_key: 'sk-placeholder-not-a-real-key',
          model: 'gpt-4o-mini',
        })
      ),
    },
  ]);

  // Provider-owned webhook for Slack (mirrors createProvider behavior)
  await db.insert(schema.incomingWebhooks).values({
    id: IDS.incomingWebhooks.slack,
    providerId: IDS.providers.slack,
    triggerId: null,
    path: slackWebhookPath,
    method: 'POST',
  });

  // --------------------------------------------------------------------------
  // 12. Secrets
  // --------------------------------------------------------------------------
  console.log('  secrets...');
  await db.insert(schema.secrets).values([
    {
      namespaceId: IDS.namespace,
      name: 'SLACK_BOT_TOKEN',
      provider: 'manual',
      encryptedValue: 'xoxb-placeholder-not-a-real-token',
    },
    {
      namespaceId: IDS.namespace,
      name: 'GITHUB_API_KEY',
      provider: 'manual',
      encryptedValue: 'ghp_placeholder-not-a-real-key',
    },
    {
      namespaceId: IDS.namespace,
      name: 'POSTGRES_URL',
      provider: 'manual',
      encryptedValue: 'postgresql://placeholder:placeholder@db:5432/app',
    },
  ]);

  console.log(
    `Seeded: 3 users, 1 org, 2 folders, 4 workflows, 5 providers, ${executions.length} executions, ${logs.length} logs, 3 secrets`
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
