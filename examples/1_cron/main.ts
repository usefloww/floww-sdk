import { getProvider } from "floww";

const builtin = getProvider("builtin");

builtin.triggers.onCron({
  expression: "*/1 * * * * *",
  handler: (ctx, event) => {
    console.log("Do this every second", event.scheduledTime);
  },
});
