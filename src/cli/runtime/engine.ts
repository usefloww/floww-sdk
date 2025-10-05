import { Trigger, WebhookTrigger, CronTrigger, RealtimeTrigger, Provider } from '../../common';
import { SecretManager } from '../secrets/secretManager';
import { executeUserProject, getUserProject } from '@/codeExecution';
import { EventStream, EventProducer } from './types';
import { WebhookEventProducer } from './eventProducers/webhookEventProducer';
import { CronEventProducer } from './eventProducers/cronEventProducer';
import { WebSocketEventProducer } from './eventProducers/websocketEventProducer';
import { ApiClient } from '../api/client';
import { getConfig } from '../config/configUtils';
import { tryLoadProjectConfig, ProjectConfig } from '../config/projectConfig';

export class FlowEngine {
  private eventStream = new EventStream();
  private eventProducers: EventProducer[] = [];
  private triggers: Trigger[] = [];
  private secretManager = new SecretManager();
  private providers: Set<Provider> = new Set();
  private webhookMetadata: Map<WebhookTrigger, Map<string, any>> = new Map();
  private realtimeMetadata: Map<RealtimeTrigger, Map<string, any>> = new Map();
  private projectConfig: ProjectConfig | null = null;

  constructor(private port: number, private host: string) {
    this.eventProducers = [
      new WebhookEventProducer(port, host),
      new CronEventProducer(),
      new WebSocketEventProducer()
    ];

    // Initialize API client and SecretManager
    const config = getConfig();
    const apiClient = new ApiClient(config.backendUrl, config.workosClientId);

    // Try to load project config
    this.projectConfig = tryLoadProjectConfig();

    // Get namespace ID from project config or environment variable
    let namespaceId: string | undefined;

    if (this.projectConfig) {
      namespaceId = this.projectConfig.namespaceId;
      console.log(`📋 Loaded project config: ${this.projectConfig.name}`);
      if (this.projectConfig.workflowId) {
        console.log(`   Workflow ID: ${this.projectConfig.workflowId}`);
      }
    } else {
      // Fall back to environment variable
      namespaceId = process.env.FLOWW_NAMESPACE_ID;
      if (namespaceId) {
        console.log('⚠️  No floww.yaml found, using FLOWW_NAMESPACE_ID from environment');
        console.log('   Run "floww init" to create a project config file');
      }
    }

    if (!namespaceId) {
      throw new Error(
        'No namespace ID found. Either:\n' +
        '  1. Run "floww init" to create a floww.yaml file, or\n' +
        '  2. Set the FLOWW_NAMESPACE_ID environment variable'
      );
    }

    this.secretManager = new SecretManager(apiClient, namespaceId);
  }

  async load(filePath: string): Promise<Trigger[]> {
    const userProject = await getUserProject(filePath, 'default');
    const module = await executeUserProject(userProject);
    const triggers = module.default;

    if (!Array.isArray(triggers)) {
      throw new Error('Triggers file must export an array of triggers as default export');
    }

    this.triggers = triggers;
    this.extractProviders(module);
    return triggers;
  }

  private extractProviders(module: any): void {
    for (const key in module) {
      const value = module[key];
      if (value && typeof value === 'object' && 'providerType' in value && 'triggers' in value) {
        this.providers.add(value as Provider);
      }
    }
  }

  private async promptForMissingSecrets(): Promise<void> {
    for (const provider of this.providers) {
      if (!provider.secretDefinitions || provider.secretDefinitions.length === 0) {
        continue;
      }

      const credentialName = provider.credentialName || 'default';
      const secrets = await this.secretManager.ensureProviderSecrets(
        provider.providerType,
        credentialName,
        provider.secretDefinitions
      );

      if (provider.configure) {
        provider.configure(secrets);
      }
    }
  }

  private setupEventRouting(): void {
    this.eventStream.on('data', async (event) => {
      try {
        if (event.trigger) {
          // Direct trigger provided (webhook/cron)
          await event.trigger.handler({}, event.data);
        } else if (event.type === 'realtime') {
          // Find matching realtime triggers
          const realtimeTriggers = this.triggers.filter(t => t.type === 'realtime') as RealtimeTrigger[];
          for (const trigger of realtimeTriggers) {
            if (trigger.channel === event.data.channel &&
                (!trigger.messageType || trigger.messageType === event.data.type)) {
              await trigger.handler({}, event.data);
            }
          }
        }
      } catch (error) {
        console.error(`Error in ${event.type} handler:`, error);
      }
    });
  }

  private async updateProducers(): Promise<void> {
    // Update all producers with current triggers
    for (const producer of this.eventProducers) {
      await producer.updateTriggers(this.triggers, this.eventStream);
    }

    // Log triggers
    for (const trigger of this.triggers) {
      if (trigger.type === 'webhook') {
        console.log(`📌 Webhook: ${(trigger as WebhookTrigger).method || 'POST'} ${(trigger as WebhookTrigger).path || '/webhook'}`);
      } else if (trigger.type === 'cron') {
        console.log(`⏰ Cron: ${(trigger as CronTrigger).expression}`);
      } else if (trigger.type === 'realtime') {
        console.log(`📡 Realtime: ${(trigger as RealtimeTrigger).channel}`);
      }
    }
  }

  async start() {
    console.log(`\n🚀 Starting Flow Engine...`);
    console.log(`📁 Loaded ${this.triggers.length} trigger(s)\n`);

    await this.promptForMissingSecrets();
    this.setupEventRouting();
    await this.updateProducers();

    console.log(`\n✅ Flow Engine is running`);
  }

  async stop() {
    console.log('\n🛑 Stopping Flow Engine...');

    for (const producer of this.eventProducers) {
      await producer.stop();
    }

    this.eventStream.removeAllListeners();
    console.log('\n👋 Flow Engine stopped');
  }

  async reload(filePath: string) {
    console.log('\n🔄 Reloading triggers...');

    await this.load(filePath);
    await this.updateProducers();

    console.log(`\n✅ Triggers reloaded successfully`);
  }
}