import { CronTrigger } from '@DeveloperFlows/floww-sdk';

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
