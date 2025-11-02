import { Builtin } from "floww";

const builtin = new Builtin();

builtin.triggers.onCron({
  expression: "*/1 * * * * *",
  handler: (ctx, event) => {
    console.log("Do this every second", event.scheduledTime);
  },
});
