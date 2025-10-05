import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import { initProjectConfig, hasProjectConfig, getProjectConfigPath } from '../config/projectConfig';

interface InitOptions {
  force?: boolean;
  name?: string;
  namespace?: string;
  description?: string;
}

export async function initCommand(options: InitOptions = {}) {
  console.log('🚀 Initializing new Floww project\n');

  // Check if config already exists
  if (hasProjectConfig() && !options.force) {
    console.error('❌ floww.yaml already exists in this directory.');
    console.error('   Use --force to overwrite or run this command in a different directory.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  try {
    // Get workflow name
    let name = options.name;
    if (!name) {
      name = await question('Workflow name: ');
      if (!name) {
        console.error('\n❌ Workflow name is required');
        process.exit(1);
      }
    }

    // Get namespace ID
    let namespaceId = options.namespace;
    if (!namespaceId) {
      console.log('\nYou can find your namespace ID in the Floww dashboard or via the API.');
      namespaceId = await question('Namespace ID: ');
      if (!namespaceId) {
        console.error('\n❌ Namespace ID is required');
        process.exit(1);
      }
    }

    // Validate namespace ID is a valid UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(namespaceId)) {
      console.error('\n❌ Invalid namespace ID format. Expected a UUID.');
      process.exit(1);
    }

    // Get optional description
    let description = options.description;
    if (!description) {
      description = await question('Description (optional): ');
    }

    // Create config
    const config = {
      namespaceId,
      name,
      ...(description && { description }),
      version: '1.0.0',
    };

    // Save config
    initProjectConfig(config, process.cwd(), options.force);

    console.log('\n✅ Created floww.yaml');
    console.log(`   Namespace: ${namespaceId}`);
    console.log(`   Name: ${name}`);
    if (description) {
      console.log(`   Description: ${description}`);
    }

    // Create example workflow file if it doesn't exist
    const exampleFile = path.join(process.cwd(), 'triggers.ts');
    if (!fs.existsSync(exampleFile)) {
      const shouldCreateExample = await question('\nCreate example triggers.ts file? (Y/n): ');
      if (!shouldCreateExample || shouldCreateExample.toLowerCase() === 'y') {
        createExampleWorkflow(exampleFile);
        console.log('✅ Created triggers.ts');
      }
    }

    console.log('\n🎉 Project initialized successfully!');
    console.log('\nNext steps:');
    console.log('  1. Edit your workflow in triggers.ts');
    console.log('  2. Run: floww dev triggers.ts');
    console.log('  3. Start building! 🚀\n');

  } catch (error) {
    console.error('\n❌ Failed to initialize project:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function createExampleWorkflow(filePath: string) {
  const template = `import { CronTrigger } from '@DeveloperFlows/floww-sdk';

// Example cron trigger that runs every minute
const exampleCron: CronTrigger = {
  type: 'cron',
  expression: '* * * * *', // Every minute
  handler: async () => {
    console.log('Hello from your workflow! 👋');
    console.log('Current time:', new Date().toISOString());
  },
};

export default [exampleCron];
`;

  fs.writeFileSync(filePath, template, 'utf-8');
}
