import { Provider, Handler, Trigger } from "../common"

export class Builtin implements Provider {
    actions = {}
    triggers = {
        cron: (args: { data: { expression: string }, handler: Handler }): Trigger => {
            return {
                infrastructure: [],
                handler: args.handler,
            }
        },
        webhook: (args: { handler: Handler }): Trigger => {
            return {
                infrastructure: [],
                handler: args.handler,
            }
        }
    }
}