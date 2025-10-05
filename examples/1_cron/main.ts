import { Builtin } from "@developerflows/floww-sdk";


export const builtin = new Builtin();

export default [
    builtin.triggers.onCron({
        expression: "*/5 * * * * *",
        handler: (ctx, event) => {
            console.log('Cron triggered', event.scheduledTime)
        }
    })
]
