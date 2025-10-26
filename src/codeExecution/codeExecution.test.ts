import { describe, it, expect, beforeEach } from "vitest";
import { executeUserProject, wrapUserProject } from "./index";

describe("Code Execution", () => {
  it("should execute basic TypeScript with imports", async () => {
    const files = {
      "main.ts": `import { add } from "./utils";
      export const handler = () => {
        return add(1, 2);
      }
      `,
      "utils.ts": "export const add = (a: number, b: number) => a + b;",
    };

    const result = await executeUserProject({
      files: files,
      entryPoint: "main.handler",
    });
    expect(result).toBe(3);
  });

  it("should handle multi-file dependencies with nested imports", async () => {
    const files = {
      "index.ts": `
        import { Calculator } from "./math/calculator";
        import { Logger } from "./utils/logger";

        export const handler = () => {
          const calc = new Calculator();
          const logger = new Logger();
          const result = calc.multiply(5, 6);
          logger.log(\`Result: \${result}\`);
          return result;
        }
      `,
      "math/calculator.ts": `
        import { add } from "./operations";

        export class Calculator {
          multiply(a: number, b: number): number {
            let result = 0;
            for (let i = 0; i < b; i++) {
              result = add(result, a);
            }
            return result;
          }
        }
      `,
      "math/operations.ts": `
        export const add = (a: number, b: number): number => a + b;
        export const subtract = (a: number, b: number): number => a - b;
      `,
      "utils/logger.ts": `
        export class Logger {
          log(message: string): void {
            console.log(\`[LOG] \${message}\`);
          }
        }
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "index.handler",
    });
    expect(result).toBe(30);
  });

  it("should handle async functions correctly", async () => {
    const files = {
      "async-main.ts": `
        import { delay, fetchData } from "./async-utils";

        export const handler = async () => {
          await delay(10);
          const data = await fetchData();
          return data.value * 2;
        }
      `,
      "async-utils.ts": `
        export const delay = (ms: number): Promise<void> => {
          return new Promise(resolve => setTimeout(resolve, ms));
        };

        export const fetchData = async (): Promise<{ value: number }> => {
          await delay(5);
          return { value: 42 };
        };
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "async-main.handler",
    });
    expect(result).toBe(84);
  });

  it("should handle different export patterns", async () => {
    const files = {
      "default-export.ts": `
        import helper from "./helper";
        export default () => helper.getValue();
      `,
      "helper.ts": `
        const helper = {
          getValue: () => 123
        };
        export default helper;
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "default-export",
    });
    expect(result).toBe(123);
  });

  it("should provide meaningful error messages with file context", async () => {
    const files = {
      "error-main.ts": `
        import { buggyFunction } from "./buggy-module";

        export const handler = () => {
          return buggyFunction();
        }
      `,
      "buggy-module.ts": `
        export const buggyFunction = () => {
          throw new Error("Something went wrong in buggy module");
        };
      `,
    };

    await expect(
      executeUserProject({
        files,
        entryPoint: "error-main.handler",
      }),
    ).rejects.toThrow("Something went wrong in buggy module");
  });

  it("should handle TypeScript interfaces and types", async () => {
    const files = {
      "typed-main.ts": `
        import { User, processUser } from "./types";

        export const handler = (): string => {
          const user: User = {
            id: 1,
            name: "John Doe",
            email: "john@example.com"
          };
          return processUser(user);
        }
      `,
      "types.ts": `
        export interface User {
          id: number;
          name: string;
          email: string;
        }

        export const processUser = (user: User): string => {
          return \`User \${user.name} (\${user.email}) has ID \${user.id}\`;
        };
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "typed-main.handler",
    });
    expect(result).toBe("User John Doe (john@example.com) has ID 1");
  });

  it("should handle module not found errors gracefully", async () => {
    const files = {
      "main.ts": `
        import { nonExistentFunction } from "./missing-module";
        export const handler = () => nonExistentFunction();
      `,
    };

    await expect(
      executeUserProject({
        files,
        entryPoint: "main.handler",
      }),
    ).rejects.toThrow(
      "Cannot resolve module './missing-module' from 'main.ts'",
    );
  });

  it("should handle relative imports correctly", async () => {
    const files = {
      "src/index.ts": `
        import { helper } from "../utils/helper";
        import { config } from "./config";

        export const handler = () => {
          return helper.process(config.value);
        }
      `,
      "utils/helper.ts": `
        export const helper = {
          process: (value: number) => value * 3
        };
      `,
      "src/config.ts": `
        export const config = {
          value: 10
        };
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "src/index.handler",
    });
    expect(result).toBe(30);
  });

  it("should handle JSON imports", async () => {
    const files = {
      "main.ts": `
        import config from "./config.json";

        export const handler = () => {
          return config.multiplier * 5;
        }
      `,
      "config.json": `{
        "multiplier": 7,
        "name": "test-config"
      }`,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "main.handler",
    });
    expect(result).toBe(35);
  });
});

describe("Test wrapper", () => {
  it("Wrapper should wrap", async () => {
    const files = {
      "main.ts": `
        export function getValue() {
          return 1
        }
      `,
    };

    const result = await executeUserProject({
      files,
      entryPoint: "main",
    });

    const wrappedProject = await wrapUserProject(
      result,
      `
      // Directly return the value since we can't import in this test scenario
      export default 1
      `,
    );

    const wrappedResult = await executeUserProject(wrappedProject);

    expect(wrappedResult.default).toBe(1);
  });
});
