import {
    Provider,
    CronTrigger,
    CronTriggerArgs,
    WebhookTrigger,
    WebhookTriggerArgs
} from "../common"

export class Builtin implements Provider {
    actions = {}
    triggers = {
        onCron: (args: CronTriggerArgs): CronTrigger => {
            return {
                type: 'cron',
                expression: args.expression,
                handler: args.handler,
            }
        },
        onWebhook: <TBody = any>(args: WebhookTriggerArgs<TBody>): WebhookTrigger<TBody> => {
            return {
                type: 'webhook',
                handler: args.handler,
                path: args.path,
                method: args.method || 'POST',
                setup: args.setup,
                teardown: args.teardown,
            }
        }
    }
}
