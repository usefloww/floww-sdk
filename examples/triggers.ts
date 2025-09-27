import { Trigger } from "@trigger/sdk";
import { googleCalendar, builtin, gitlab } from "./providers";


export default [
    builtin.triggers.cron({
        data: { expression: "0 0 * * *" },
        handler: (ctx, event) => {
            console.log(event);
        }
    }),
    googleCalendar.triggers.onEventCreate({
        data: { calendarId: "primary" },
        handler: (ctx, event) => {
            console.log(event);
        }
    }),
    gitlab.triggers.onMergeRequestComment({
        data: { projectId: "1234567890" },
        handler: (ctx, event) => {}
    }),
] satisfies Trigger[]
