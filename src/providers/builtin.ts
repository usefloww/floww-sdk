import {
  CronTrigger,
  CronTriggerArgs,
  ManualTrigger,
  ManualTriggerArgs,
  WebhookTrigger,
  WebhookTriggerArgs,
} from "../common";
import { BaseProvider } from "./base";
import { registerTrigger } from "../userCode/providers";

export class Builtin extends BaseProvider {
  constructor(config?: any) {
    super("builtin", config);
  }

  actions = {};
  triggers = {
    onCron: (args: CronTriggerArgs): CronTrigger => {
      const trigger = {
        type: "cron",
        expression: args.expression,
        handler: args.handler,
      } as CronTrigger;
      return registerTrigger(trigger, {
        type: this.providerType,
        alias: this.credentialName,
        triggerType: "onCron",
        input: { expression: args.expression },
      });
    },
    onWebhook: <TBody = any>(
      args: WebhookTriggerArgs<TBody>,
    ): WebhookTrigger<TBody> => {
      const trigger = {
        type: "webhook",
        handler: args.handler,
        path: args.path,
        method: args.method || "POST",
        setup: args.setup,
        teardown: args.teardown,
      } as WebhookTrigger<TBody>;
      return registerTrigger(trigger, {
        type: this.providerType,
        alias: this.credentialName,
        triggerType: "onWebhook",
        input: { path: args.path, method: args.method || "POST" },
      });
    },
    onManual: <TInput = any>(
      args: ManualTriggerArgs<TInput>,
    ): ManualTrigger<TInput> => {
      const trigger = {
        type: "manual",
        name: args.name,
        description: args.description,
        inputSchema: args.inputSchema,
        handler: args.handler,
      } as ManualTrigger<TInput>;
      return registerTrigger(trigger, {
        type: this.providerType,
        alias: this.credentialName,
        triggerType: "onManual",
        input: {
          name: args.name,
          description: args.description,
          input_schema: args.inputSchema,
        },
      });
    },
  };
}
