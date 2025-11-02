import {
  WebhookTrigger,
  Handler,
  WebhookEvent,
  WebhookContext,
} from "../common";
import { BaseProvider, BaseProviderConfig } from "./base";
import { SlackApi } from "./slack/api";
import { Action } from "../common";
import { registerTrigger } from "../userCode/providers";

export type SlackConfig = BaseProviderConfig & {
  workspace_url?: string;
};

export type SendMessageArgs = {
  channel: string;
  text?: string;
  blocks?: any[];
  attachments?: any;
  thread_ts?: string;
  reply_broadcast?: boolean;
  mrkdwn?: boolean;
};

// Slack Events API - Message Event
// Reference: https://api.slack.com/events/message
export type SlackMessageEvent = {
  type: "event_callback";
  team_id: string;
  event: {
    type: "message";
    channel: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    channel_type: "channel" | "group" | "im" | "mpim";
    [key: string]: any;
  };
  event_time: number;
};

export type SlackOnMessageArgs = {
  channelId?: string; // Optional: filter by specific channel
  userId?: string; // Optional: filter by specific user
  handler: Handler<WebhookEvent<SlackMessageEvent>, WebhookContext>;
};

class SlackActions {
  constructor(private getApi: () => SlackApi) {}

  async sendMessage(args: SendMessageArgs): Promise<any> {
    const api = this.getApi();
    return await api.sendMessage({
      channel: args.channel,
      text: args.text,
      blocks: args.blocks,
      attachments: args.attachments,
      thread_ts: args.thread_ts,
      reply_broadcast: args.reply_broadcast,
      mrkdwn: args.mrkdwn ?? true,
    });
  }

  async updateMessage(
    args: { channel: string; ts: string } & Partial<SendMessageArgs>
  ): Promise<any> {
    const api = this.getApi();
    return await api.updateMessage(args.channel, args.ts, {
      text: args.text,
      blocks: args.blocks,
      attachments: args.attachments,
    });
  }

  async deleteMessage(args: { channel: string; ts: string }): Promise<any> {
    const api = this.getApi();
    return await api.deleteMessage(args.channel, args.ts);
  }

  async addReaction(args: {
    channel: string;
    timestamp: string;
    name: string;
  }): Promise<any> {
    const api = this.getApi();
    return await api.addReaction(args.channel, args.timestamp, args.name);
  }

  async removeReaction(args: {
    channel: string;
    timestamp: string;
    name: string;
  }): Promise<any> {
    const api = this.getApi();
    return await api.removeReaction(args.channel, args.timestamp, args.name);
  }

  async uploadFile(args: {
    channels: string;
    file: Buffer | string;
    filename?: string;
    title?: string;
    initialComment?: string;
  }): Promise<any> {
    const api = this.getApi();
    return await api.uploadFile(
      args.channels,
      args.file,
      args.filename,
      args.title,
      args.initialComment
    );
  }

  async listChannels(): Promise<any> {
    const api = this.getApi();
    return await api.listChannels();
  }

  async getChannel(args: { channelId: string }): Promise<any> {
    const api = this.getApi();
    return await api.getChannel(args.channelId);
  }

  async createChannel(args: {
    name: string;
    isPrivate?: boolean;
  }): Promise<any> {
    const api = this.getApi();
    return await api.createChannel(args.name, args.isPrivate);
  }

  async listUsers(): Promise<any> {
    const api = this.getApi();
    return await api.listUsers();
  }

  async getUser(args: { userId: string }): Promise<any> {
    const api = this.getApi();
    return await api.getUser(args.userId);
  }

  async conversationHistory(args: {
    channelId: string;
    cursor?: string;
    inclusive?: boolean;
    latest?: string;
    limit?: number;
    oldest?: string;
    include_all_metadata?: boolean;
  }): Promise<any> {
    const api = this.getApi();
    return await api.getConversationHistory(args.channelId, {
      cursor: args.cursor,
      inclusive: args.inclusive,
      latest: args.latest,
      limit: args.limit,
      oldest: args.oldest,
      include_all_metadata: args.include_all_metadata,
    });
  }
}

export class Slack extends BaseProvider {
  private api?: SlackApi;
  actions: SlackActions;

  constructor(config?: SlackConfig | string) {
    super("slack", config);
    this.actions = new SlackActions(() => this.getApi());
  }

  private getApi(): SlackApi {
    if (!this.api) {
      const botToken = this.getConfig("bot_token");
      this.api = new SlackApi({ botToken });
    }
    return this.api;
  }

  triggers = {
    /**
     * Triggers when a message is posted to a Slack channel.
     *
     * The trigger is registered on the backend and filtering is handled server-side.
     *
     * @param args Configuration for the message trigger
     * @param args.channelId Optional: Filter messages from a specific channel
     * @param args.userId Optional: Filter messages from a specific user
     * @param args.handler Function to handle incoming message events
     */
    onMessage: (
      args: SlackOnMessageArgs
    ): WebhookTrigger<SlackMessageEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onMessage",
          input: {
            channel_id: args.channelId,
            user_id: args.userId,
          },
        }
      );
    },
  };
}
