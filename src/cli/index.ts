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

program.parse();
