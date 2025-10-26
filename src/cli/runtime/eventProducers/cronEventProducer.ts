import cron from "node-cron";
import { CronTrigger, CronEvent, Trigger } from "../../../common";
import { EventProducer, EventStream } from "../types";

export class CronEventProducer implements EventProducer {
  private tasks: cron.ScheduledTask[] = [];

  async updateTriggers(
    triggers: Trigger[],
    stream: EventStream,
  ): Promise<void> {
    // Stop all existing tasks
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];

    // Filter cron triggers
    const cronTriggers = triggers.filter(
      (t) => t.type === "cron",
    ) as CronTrigger[];

    // Start new tasks
    for (const trigger of cronTriggers) {
      const task = cron.schedule(trigger.expression, () => {
        const cronEvent: CronEvent = {
          scheduledTime: new Date(),
          actualTime: new Date(),
        };
        stream.emit("data", { type: "cron", trigger, data: cronEvent });
      });
      this.tasks.push(task);
      task.start();
    }
  }

  async stop(): Promise<void> {
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
  }
}
