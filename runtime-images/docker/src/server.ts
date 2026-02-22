// Floww Docker Runtime HTTP Server
// Provides /health and /execute endpoints for container-based workflow execution

import Fastify from "fastify";
import { handleEvent } from "floww/runtime";

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get("/health", async () => {
  return { status: "ok" };
});

// Main execution endpoint
fastify.post("/execute", async (request, reply) => {
  const event = request.body as any;

  // Handle the event (routing to appropriate handler based on type)
  const result = await handleEvent(event);

  // Return Docker-formatted response
  if (result.success) {
    return {
      statusCode: 200,
      ...result,
    };
  } else {
    reply.code(500);
    return {
      statusCode: 500,
      error: "Internal Server Error",
      message: result.error?.message || "Unknown error",
    };
  }
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "8000");
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });

    console.log("🚀 Floww Docker Runtime Server started");
    console.log(`   Listening on ${host}:${port}`);
    console.log(`   Health: http://${host}:${port}/health`);
    console.log(`   Execute: http://${host}:${port}/execute`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
