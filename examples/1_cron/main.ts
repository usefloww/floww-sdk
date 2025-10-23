import { Builtin, getProvider } from "@developerflows/floww-sdk";

export const builtin = new Builtin();

export const gitlab = getProvider("gitlab");

export default [
  builtin.triggers.onCron({
    expression: "*/1 * * * * *",
    handler: (ctx, event) => {
      console.log("Cron triggered", event.scheduledTime);
    },
  }),
];
