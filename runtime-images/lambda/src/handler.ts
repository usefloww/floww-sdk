// Universal Lambda handler for Floww workflows
// Assumes floww is available in the runtime

import { invokeTrigger, InvokeTriggerEvent } from "floww/runtime";

export const handler = async (event: InvokeTriggerEvent, context: any) => {
  // Invoke the trigger (reporting handled internally)
  const result = await invokeTrigger(event);

  // Return Lambda-formatted response
  if (result.success) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Workflow executed successfully",
        triggersProcessed: result.triggersProcessed,
      }),
    };
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: result.error?.message || "Unknown error",
      }),
    };
  }
};
