import { Builtin } from "floww";

const builtin = new Builtin();

builtin.triggers.onCron({
  expression: "*/5 * * * *",
  handler: (ctx, event) => {
    console.log("Do this every second", event.scheduledTime);
  },
});

builtin.triggers.onManual({
  name: "manual-trigger",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  },
  handler: (ctx, event) => {
    console.log("Manual trigger", event.input_data);
  },
});
