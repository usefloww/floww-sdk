import {
    CronTrigger,
    CronTriggerArgs,
    WebhookTrigger,
    WebhookTriggerArgs
} from "../common"
import { BaseProvider } from "./base";
import { registerTrigger } from "../userCode/providers";

export class Builtin extends BaseProvider {
    providerType = 'builtin';

    constructor() {
        super(); // No credential name needed for builtin
    }

    actions = {}
    triggers = {
        onCron: (args: CronTriggerArgs): CronTrigger => {
            const trigger = {
                type: 'cron',
                expression: args.expression,
                handler: args.handler,
            } as CronTrigger;
            return registerTrigger(trigger);
        },
        onWebhook: <TBody = any>(args: WebhookTriggerArgs<TBody>): WebhookTrigger<TBody> => {
            const trigger = {
                type: 'webhook',
                handler: args.handler,
                path: args.path,
                method: args.method || 'POST',
                setup: args.setup,
                teardown: args.teardown,
            } as WebhookTrigger<TBody>;
            return registerTrigger(trigger);
        }
    }
}
