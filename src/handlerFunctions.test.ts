import { describe, it, expect } from "vitest";
import { provision } from "./handlerFunctions";

describe("Test Provision", () => {
  it("test provision empty", async () => {
    await provision([]);
  });
});
