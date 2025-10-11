#!/usr/bin/env node
import { Command } from 'commander';
import { devCommand } from './commands/dev';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import {
  configSetCommand,
  configGetCommand,
  configListCommand,
  configResetCommand,
  configHelpCommand
} from './commands/config';
import { setConfig } from './config/configUtils';
import { deployCommand } from './commands/deploy';
import { initCommand } from './commands/init';
import { listWorkflowsCommand, listNamespacesCommand } from './crud/list';

const program = new Command();

program
  .name('floww')
  .description('CLI for running trigger-based workflows')
  .version('1.0.0')
  .option('--backend-url <url>', 'Backend API URL')
  .option('--workos-client-id <id>', 'WorkOS client ID')
  .option('--registry-url <url>', 'Docker registry URL');

program
  .command('init')
  .description('Initialize a new Floww project')
  .option('--force', 'Overwrite existing floww.json')
  .option('--name <name>', 'Workflow name')
  .option('--namespace <id>', 'Namespace ID')
  .option('--description <desc>', 'Workflow description')
  .action(async (options) => {
    await initCommand(options);
  });

program
  .command('dev')
  .description('Run triggers in development mode with auto-reload')
  .argument('[file]', 'Path to the triggers file (defaults to entrypoint from floww.yaml)')
  .option('-p, --port <port>', 'Port for webhook server', '3000')
  .option('-h, --host <host>', 'Host for webhook server', 'localhost')
  .option('--debug', 'Enable debugging mode with enhanced logging and inspector')
  .option('--debug-port <port>', 'Inspector port for debugging (default: 9229)', '9229')
  .action(devCommand);

program
  .command('deploy')
  .description('Deploy triggers to the server (uses entrypoint from floww.yaml)')
  .action(deployCommand);

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

// List commands
const listCmd = program
  .command('list')
  .description('List resources');

listCmd
  .command('workflows')
  .description('List all workflows')
  .action(listWorkflowsCommand);

listCmd
  .command('namespaces')
  .description('List all namespaces')
  .action(listNamespacesCommand);

// Initialize config with CLI options before parsing commands
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  const cliOptions: any = {};

  if (opts.backendUrl) cliOptions.backendUrl = opts.backendUrl;
  if (opts.workosClientId) cliOptions.workosClientId = opts.workosClientId;
  if (opts.registryUrl) cliOptions.registryUrl = opts.registryUrl;

  setConfig(cliOptions);
});

program.parse();
