// Universal Lambda handler for Floww workflows
// Assumes floww is available in the runtime

import { handleEvent } from "floww/runtime";

export const handler = async (event: any) => {
  // Handle the event (routing to appropriate handler based on type)
  const result = await handleEvent(event);

  // Return Lambda-formatted response
  if (result.success) {
    return {
      statusCode: 200,
      body: JSON.stringify(result),
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
