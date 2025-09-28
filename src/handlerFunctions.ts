import { InlineProgramArgs, LocalWorkspace } from "@pulumi/pulumi/automation";
import { Trigger } from "./common";
import fs from "node:fs";
import path from "node:path";

export const provision = async (triggers: Trigger[]) => {
  const infrastructure = triggers.flatMap((t) => t.infrastructure);

  const stateDir = path.resolve(process.cwd(), "pulumi-state");
  fs.mkdirSync(stateDir, { recursive: true });

  const pulumiProgram = async () => {
    return {
      resources: infrastructure,
    };
  };

  const args: InlineProgramArgs = {
    stackName: "dev",
    projectName: "inlineNode",
    program: pulumiProgram,
  };

  const stack = await LocalWorkspace.createOrSelectStack(args, {
    envVars: {
      PULUMI_BACKEND_URL: `file://${stateDir}`,
      PULUMI_CONFIG_PASSPHRASE: "change-me",
    },
  });

  const result = await stack.up();
  return result;
};
