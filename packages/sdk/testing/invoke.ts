import { getRegisteredTriggers } from "../userCode/providers";
import type { WebhookEvent, CronEvent, ManualEvent, RealtimeEvent } from "../common";

type InvokeResult = { success: boolean; error?: Error };

function buildWebhookEvent(partial: any): WebhookEvent {
  return {
    body: partial.body ?? {},
    headers: partial.headers ?? {},
    query: partial.query ?? {},
    method: partial.method ?? "POST",
    path: partial.path ?? "/webhook",
  };
}

function buildCronEvent(partial: any): CronEvent {
  const now = new Date();
  return {
    scheduledTime: partial.scheduledTime ?? now,
    actualTime: partial.actualTime ?? now,
  };
}

function buildManualEvent(partial: any): ManualEvent {
  return {
    manually_triggered: true,
    triggered_by: partial.triggered_by ?? "test-user",
    input_data: partial.input_data ?? {},
  };
}

function buildRealtimeEvent(partial: any): RealtimeEvent {
  return {
    type: partial.type ?? "message",
    workflow_id: partial.workflow_id ?? "test-workflow",
    payload: partial.payload ?? {},
    timestamp: partial.timestamp ?? new Date().toISOString(),
    channel: partial.channel ?? "test-channel",
  };
}

function buildEvent(triggerType: string, partial: any) {
  switch (triggerType) {
    case "webhook":
      return buildWebhookEvent(partial);
    case "cron":
      return buildCronEvent(partial);
    case "manual":
      return buildManualEvent(partial);
    case "realtime":
      return buildRealtimeEvent(partial);
    default:
      return partial;
  }
}

export function augmentTriggersWithInvoke(
  provider: { providerType: string; credentialName: string },
  triggers: Record<string, (...args: any[]) => any>
): Record<string, any> {
  const augmented: Record<string, any> = {};

  for (const [name, factory] of Object.entries(triggers)) {
    const wrapper = function (...args: any[]) {
      return factory(...args);
    };

    wrapper.invoke = async (partialEvent: any = {}): Promise<InvokeResult> => {
      const allTriggers = getRegisteredTriggers();

      const matching = allTriggers.filter((t: any) => {
        if (!t._providerMeta) return false;
        return (
          t._providerMeta.type === provider.providerType &&
          t._providerMeta.alias === provider.credentialName &&
          t._providerMeta.triggerType === name
        );
      });

      if (matching.length === 0) {
        return { success: true };
      }

      try {
        for (const trigger of matching) {
          const event = buildEvent(trigger.type, partialEvent);
          await trigger.handler({}, event);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error as Error };
      }
    };

    augmented[name] = wrapper;
  }

  return augmented;
}
