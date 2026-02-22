/**
 * Local Worker - Child Process Entry Point
 *
 * Receives an event via IPC, calls handleEvent() from floww/runtime,
 * and sends the result back to the parent process.
 */

import { handleEvent } from 'floww/runtime';

process.on('message', async (event: unknown) => {
  try {
    const result = await handleEvent(event as Parameters<typeof handleEvent>[0]);
    process.send!({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    process.send!({
      success: false,
      error: { message: error.message, stack: error.stack },
    });
  } finally {
    process.exit(0);
  }
});
