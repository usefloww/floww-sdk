import { EventEmitter } from "events";
import { Trigger } from "../../common";

export interface TriggerEvent {
  type: "webhook" | "cron" | "realtime";
  trigger: Trigger | null; // null for events that need to be routed to matching triggers
  data: any;
}

export class EventStream extends EventEmitter {
  emit(event: "data", triggerEvent: TriggerEvent): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args);
  }
}

export interface EventProducer {
  updateTriggers(triggers: Trigger[], stream: EventStream): Promise<void>;
  stop(): Promise<void>;
}
