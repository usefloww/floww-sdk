import { Builtin, Gitlab, GoogleCalendar } from "@developerflows/floww-sdk";

// Export provider instances so the CLI can extract them for secret management
export const builtin = new Builtin();

// Named credential with config
export const gitlab = new Gitlab({
    credential: 'work-account',
    baseUrl: 'https://gitlab.company.com' // Custom GitLab instance
});

// // Simple string credential (shorthand)
// export const gitlabPersonal = new Gitlab('personal');
//
// // Config with timezone setting
// export const googleCalendar = new GoogleCalendar({
//     credential: 'default',
//     timezone: 'America/New_York'
// });

type CustomBody = {
    message: string;
}

export default [
    builtin.triggers.onWebhook<CustomBody>({
        handler: (ctx, event) => {
            console.log('Webhook received:', event.body.message);
            console.log('Headers:', event.headers);
        },
        path: '/custom',
    }),
    builtin.triggers.onCron({
        expression: "*/5 * * * * *",
        handler: (ctx, event) => {
            console.log('Cron triggered')
        }
    }),
    gitlab.triggers.onMergeRequestComment({
        projectId: '12345',
        handler: (ctx, event) => {
            console.log('[Work Account] GitLab MR comment:', event.body.object_attributes.note);
            console.log('User:', event.body.user.username);
        }
    }),
    // gitlabPersonal.triggers.onMergeRequestComment({
    //     projectId: '67890',
    //     handler: (ctx, event) => {
    //         console.log('[Personal Account] GitLab MR comment:', event.body.object_attributes.note);
    //         console.log('User:', event.body.user.username);
    //     }
    // }),
    // googleCalendar.triggers.onEventCreate({
    //     calendarId: 'primary',
    //     handler: (ctx, event) => {
    //         console.log('Calendar event created:', event.body.summary);
    //     }
    // })
]
