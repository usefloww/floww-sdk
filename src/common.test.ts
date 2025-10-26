import { describe, it, expect } from "vitest";
import { Trigger } from "./common";

describe("Trigger", () => {
  it("should create a trigger with correct properties", () => {
    const trigger: Trigger = {
      type: "cron",
      data: { expression: "0 0 * * *" },
      handler: (ctx, event) => {
        console.log("Test handler");
      },
    };

    expect(trigger.type).toBe("cron");
    expect(trigger.data).toEqual({ expression: "0 0 * * *" });
    expect(typeof trigger.handler).toBe("function");
  });
});
