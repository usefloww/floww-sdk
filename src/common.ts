import * as pulumi from "@pulumi/pulumi";

export type Handler = (ctx: any, event: Event) => void;

export type Infrastructure = pulumi.Resource;

export interface Trigger {
  handler: Handler;
  infrastructure: Infrastructure[];
}

export interface Action {}

export interface Provider {
  triggers: Record<string, (...args: any[]) => Trigger>;
  actions: Record<string, (...args: any[]) => Action>;
}
