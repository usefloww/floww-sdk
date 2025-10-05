#!/usr/bin/env node
import { Command } from 'commander';
import { devCommand } from './commands/dev';
import { startCommand } from './commands/start';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import {
  configSetCommand,
  configGetCommand,
  configListCommand,
  configResetCommand,
  configHelpCommand
} from './commands/config';
import { defaultApiClient } from './api/client';
import { CentrifugoManager } from './runtime/centrifugo';
import { setConfig } from './config/configUtils';

const program = new Command();

program
  .name('floww')
  .description('CLI for running trigger-based workflows')
  .version('1.0.0')
  .option('--backend-url <url>', 'Backend API URL')
  .option('--workos-client-id <id>', 'WorkOS client ID');

program
  .command('dev')
  .description('Run triggers in development mode with auto-reload')
  .argument('<file>', 'Path to the triggers file')
  .option('-p, --port <port>', 'Port for webhook server', '3000')
  .option('-h, --host <host>', 'Host for webhook server', 'localhost')
  .action(devCommand);

program
  .command('start')
  .description('Run triggers in production mode')
  .argument('<file>', 'Path to the triggers file')
  .option('-p, --port <port>', 'Port for webhook server', '3000')
  .option('-h, --host <host>', 'Host for webhook server', '0.0.0.0')
  .action(startCommand);

program
  .command('login')
  .description('Login')
  .action(loginCommand);

program
  .command('logout')
  .description('Logout')
  .action(logoutCommand);

program
  .command('whoami')
  .description('Show the current user')
  .action(whoamiCommand);

program.command('test')
  .description('Test the CLI')
  .action(async () => {
    const centrifugoManager = new CentrifugoManager();
    await centrifugoManager.subscribeToWorkflow('b19f3998-3e7b-445c-8c2e-2873b7c93ce2');
  });

// Config commands
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(configSetCommand);

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(configGetCommand);

configCmd
  .command('list')
  .description('List all configuration values')
  .action(configListCommand);

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(configResetCommand);

configCmd
  .command('help')
  .description('Show configuration help')
  .action(configHelpCommand);

// Initialize config with CLI options before parsing commands
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  const cliOptions: any = {};

  if (opts.backendUrl) cliOptions.backendUrl = opts.backendUrl;
  if (opts.workosClientId) cliOptions.workosClientId = opts.workosClientId;

  setConfig(cliOptions);
});

program.parse();
