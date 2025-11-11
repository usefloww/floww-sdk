import {
  WebhookTrigger,
  Handler,
  WebhookEvent,
  WebhookContext,
} from "../common";
import { BaseProvider, BaseProviderConfig } from "./base";
import { DiscordApi } from "./discord/api";
import { registerTrigger } from "../userCode/providers";
import type {
  DiscordMessage,
  DiscordChannel,
  DiscordMember,
  DiscordEmbed,
  SendMessageArgs,
  SendDirectMessageArgs,
  EditMessageArgs,
  DeleteMessageArgs,
  GetMessageArgs,
  GetMessagesArgs,
  AddReactionArgs,
  RemoveReactionArgs,
  CreateChannelArgs,
  UpdateChannelArgs,
  DeleteChannelArgs,
  GetChannelArgs,
  ListChannelsArgs,
  AddRoleArgs,
  RemoveRoleArgs,
  GetMemberArgs,
  ListMembersArgs,
  KickMemberArgs,
  BanMemberArgs,
  UnbanMemberArgs,
  CreateEmbedArgs,
  DiscordMessageEvent,
  DiscordReactionEvent,
  DiscordMemberJoinEvent,
  DiscordMemberLeaveEvent,
  DiscordMemberUpdateEvent,
} from "./discord/types";

export type DiscordConfig = BaseProviderConfig;

// ============================================================================
// Trigger Event Args Types
// ============================================================================

export type DiscordOnMessageArgs = {
  guildId?: string; // Optional: filter by specific guild (server)
  channelId?: string; // Optional: filter by specific channel
  userId?: string; // Optional: filter by specific user
  includeBots?: boolean; // Optional: include bot messages (default: false)
  includeEdits?: boolean; // Optional: include message edit events (default: false)
  handler: Handler<WebhookEvent<DiscordMessageEvent>, WebhookContext>;
};

export type DiscordOnReactionArgs = {
  guildId?: string; // Optional: filter by specific guild
  channelId?: string; // Optional: filter by specific channel
  emoji?: string; // Optional: filter by specific emoji name
  userId?: string; // Optional: filter by specific user
  handler: Handler<WebhookEvent<DiscordReactionEvent>, WebhookContext>;
};

export type DiscordOnMemberJoinArgs = {
  guildId?: string; // Optional: filter by specific guild
  handler: Handler<WebhookEvent<DiscordMemberJoinEvent>, WebhookContext>;
};

export type DiscordOnMemberLeaveArgs = {
  guildId?: string; // Optional: filter by specific guild
  handler: Handler<WebhookEvent<DiscordMemberLeaveEvent>, WebhookContext>;
};

export type DiscordOnMemberUpdateArgs = {
  guildId?: string; // Optional: filter by specific guild
  trackRoles?: boolean; // Optional: track role changes (default: true)
  trackNickname?: boolean; // Optional: track nickname changes (default: true)
  handler: Handler<WebhookEvent<DiscordMemberUpdateEvent>, WebhookContext>;
};

// ============================================================================
// Actions Class
// ============================================================================

class DiscordActions {
  constructor(private getApi: () => DiscordApi) {}

  // ==========================================================================
  // Message Actions
  // ==========================================================================

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(args: SendMessageArgs): Promise<DiscordMessage> {
    const api = this.getApi();
    return await api.sendMessage(args);
  }

  /**
   * Send a direct message to a Discord user
   */
  async sendDirectMessage(args: SendDirectMessageArgs): Promise<DiscordMessage> {
    const api = this.getApi();
    return await api.sendDirectMessage(args);
  }

  /**
   * Edit an existing Discord message
   */
  async editMessage(args: EditMessageArgs): Promise<DiscordMessage> {
    const api = this.getApi();
    return await api.editMessage(args);
  }

  /**
   * Delete a Discord message
   */
  async deleteMessage(args: DeleteMessageArgs): Promise<void> {
    const api = this.getApi();
    return await api.deleteMessage(args);
  }

  /**
   * Get details of a specific Discord message
   */
  async getMessage(args: GetMessageArgs): Promise<DiscordMessage> {
    const api = this.getApi();
    return await api.getMessage(args);
  }

  /**
   * Get message history from a Discord channel
   */
  async getMessages(args: GetMessagesArgs): Promise<DiscordMessage[]> {
    const api = this.getApi();
    return await api.getMessages(args);
  }

  // ==========================================================================
  // Reaction Actions
  // ==========================================================================

  /**
   * Add an emoji reaction to a Discord message
   */
  async addReaction(args: AddReactionArgs): Promise<void> {
    const api = this.getApi();
    return await api.addReaction(args);
  }

  /**
   * Remove an emoji reaction from a Discord message
   */
  async removeReaction(args: RemoveReactionArgs): Promise<void> {
    const api = this.getApi();
    return await api.removeReaction(args);
  }

  // ==========================================================================
  // Channel Actions
  // ==========================================================================

  /**
   * Create a new Discord channel
   */
  async createChannel(args: CreateChannelArgs): Promise<DiscordChannel> {
    const api = this.getApi();
    return await api.createChannel(args);
  }

  /**
   * Update a Discord channel's settings
   */
  async updateChannel(args: UpdateChannelArgs): Promise<DiscordChannel> {
    const api = this.getApi();
    return await api.updateChannel(args);
  }

  /**
   * Delete a Discord channel
   */
  async deleteChannel(args: DeleteChannelArgs): Promise<void> {
    const api = this.getApi();
    return await api.deleteChannel(args);
  }

  /**
   * Get details of a Discord channel
   */
  async getChannel(args: GetChannelArgs): Promise<DiscordChannel> {
    const api = this.getApi();
    return await api.getChannel(args);
  }

  /**
   * List all channels in a Discord guild
   */
  async listChannels(args: ListChannelsArgs): Promise<DiscordChannel[]> {
    const api = this.getApi();
    return await api.listChannels(args);
  }

  // ==========================================================================
  // Member & Role Actions
  // ==========================================================================

  /**
   * Add a role to a Discord guild member
   */
  async addRole(args: AddRoleArgs): Promise<void> {
    const api = this.getApi();
    return await api.addRole(args);
  }

  /**
   * Remove a role from a Discord guild member
   */
  async removeRole(args: RemoveRoleArgs): Promise<void> {
    const api = this.getApi();
    return await api.removeRole(args);
  }

  /**
   * Get details of a Discord guild member
   */
  async getMember(args: GetMemberArgs): Promise<DiscordMember> {
    const api = this.getApi();
    return await api.getMember(args);
  }

  /**
   * List members of a Discord guild
   */
  async listMembers(args: ListMembersArgs): Promise<DiscordMember[]> {
    const api = this.getApi();
    return await api.listMembers(args);
  }

  /**
   * Kick a member from a Discord guild
   */
  async kickMember(args: KickMemberArgs): Promise<void> {
    const api = this.getApi();
    return await api.kickMember(args);
  }

  /**
   * Ban a member from a Discord guild
   */
  async banMember(args: BanMemberArgs): Promise<void> {
    const api = this.getApi();
    return await api.banMember(args);
  }

  /**
   * Unban a member from a Discord guild
   */
  async unbanMember(args: UnbanMemberArgs): Promise<void> {
    const api = this.getApi();
    return await api.unbanMember(args);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Create a Discord embed object (for rich message formatting)
   */
  createEmbed(args: CreateEmbedArgs): DiscordEmbed {
    const embed: DiscordEmbed = {};

    if (args.title) embed.title = args.title;
    if (args.description) embed.description = args.description;
    if (args.color !== undefined) embed.color = args.color;
    if (args.fields) embed.fields = args.fields;
    if (args.url) embed.url = args.url;
    if (args.timestamp) embed.timestamp = args.timestamp;

    if (args.thumbnail) {
      embed.thumbnail = { url: args.thumbnail };
    }

    if (args.image) {
      embed.image = { url: args.image };
    }

    if (args.footer) {
      embed.footer = args.footer;
    }

    if (args.author) {
      embed.author = args.author;
    }

    return embed;
  }
}

// ============================================================================
// Discord Provider Class
// ============================================================================

export class Discord extends BaseProvider {
  private api?: DiscordApi;
  actions: DiscordActions;

  constructor(config?: DiscordConfig | string) {
    super("discord", config);
    this.actions = new DiscordActions(() => this.getApi());
  }

  private getApi(): DiscordApi {
    if (!this.api) {
      const botToken = this.getConfig("bot_token");
      this.api = new DiscordApi({ botToken });
    }
    return this.api;
  }

  triggers = {
    /**
     * Triggers when a message is posted in a Discord channel.
     *
     * The trigger is registered on the backend and filtering is handled server-side.
     *
     * IMPORTANT: Requires "MESSAGE CONTENT INTENT" to be enabled in Discord Developer Portal:
     * 1. Go to https://discord.com/developers/applications and select your app
     * 2. Navigate to "Bot" section
     * 3. Enable "MESSAGE CONTENT INTENT" under "Privileged Gateway Intents"
     *
     * @param args Configuration for the message trigger
     * @param args.guildId Optional: Filter messages from a specific guild (server)
     * @param args.channelId Optional: Filter messages from a specific channel
     * @param args.userId Optional: Filter messages from a specific user
     * @param args.includeBots Optional: Include bot messages (default: false)
     * @param args.includeEdits Optional: Include message edit events (default: false)
     * @param args.handler Function to handle incoming message events
     */
    onMessage: (
      args: DiscordOnMessageArgs
    ): WebhookTrigger<DiscordMessageEvent> => {
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
            guild_id: args.guildId,
            channel_id: args.channelId,
            user_id: args.userId,
            include_bots: args.includeBots ?? false,
            include_edits: args.includeEdits ?? false,
          },
        }
      );
    },

    /**
     * Triggers when a reaction is added to a message in a Discord channel.
     *
     * The trigger is registered on the backend and filtering is handled server-side.
     *
     * @param args Configuration for the reaction trigger
     * @param args.guildId Optional: Filter reactions from a specific guild
     * @param args.channelId Optional: Filter reactions from a specific channel
     * @param args.emoji Optional: Filter by specific emoji name (e.g., "👍" or custom emoji name)
     * @param args.userId Optional: Filter reactions from a specific user
     * @param args.handler Function to handle incoming reaction events
     */
    onReaction: (
      args: DiscordOnReactionArgs
    ): WebhookTrigger<DiscordReactionEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onReaction",
          input: {
            guild_id: args.guildId,
            channel_id: args.channelId,
            emoji: args.emoji,
            user_id: args.userId,
          },
        }
      );
    },

    /**
     * Triggers when a new member joins a Discord guild.
     *
     * IMPORTANT: Requires "SERVER MEMBERS INTENT" to be enabled in Discord Developer Portal:
     * 1. Go to https://discord.com/developers/applications and select your app
     * 2. Navigate to "Bot" section
     * 3. Enable "SERVER MEMBERS INTENT" under "Privileged Gateway Intents"
     *
     * @param args Configuration for the member join trigger
     * @param args.guildId Optional: Filter joins from a specific guild
     * @param args.handler Function to handle incoming member join events
     */
    onMemberJoin: (
      args: DiscordOnMemberJoinArgs
    ): WebhookTrigger<DiscordMemberJoinEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onMemberJoin",
          input: {
            guild_id: args.guildId,
          },
        }
      );
    },

    /**
     * Triggers when a member leaves or is kicked from a Discord guild.
     *
     * IMPORTANT: Requires "SERVER MEMBERS INTENT" to be enabled in Discord Developer Portal.
     *
     * @param args Configuration for the member leave trigger
     * @param args.guildId Optional: Filter leaves from a specific guild
     * @param args.handler Function to handle incoming member leave events
     */
    onMemberLeave: (
      args: DiscordOnMemberLeaveArgs
    ): WebhookTrigger<DiscordMemberLeaveEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onMemberLeave",
          input: {
            guild_id: args.guildId,
          },
        }
      );
    },

    /**
     * Triggers when a member's details are updated (roles, nickname, etc.).
     *
     * IMPORTANT: Requires "SERVER MEMBERS INTENT" to be enabled in Discord Developer Portal.
     *
     * @param args Configuration for the member update trigger
     * @param args.guildId Optional: Filter updates from a specific guild
     * @param args.trackRoles Optional: Track role changes (default: true)
     * @param args.trackNickname Optional: Track nickname changes (default: true)
     * @param args.handler Function to handle incoming member update events
     */
    onMemberUpdate: (
      args: DiscordOnMemberUpdateArgs
    ): WebhookTrigger<DiscordMemberUpdateEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onMemberUpdate",
          input: {
            guild_id: args.guildId,
            track_roles: args.trackRoles ?? true,
            track_nickname: args.trackNickname ?? true,
          },
        }
      );
    },
  };
}

// Export commonly used types for user convenience
export type {
  DiscordMessage,
  DiscordChannel,
  DiscordMember,
  DiscordEmbed,
  DiscordUser,
  DiscordRole,
  DiscordChannelType,
  DiscordMessageEvent,
  DiscordReactionEvent,
  DiscordMemberJoinEvent,
  DiscordMemberLeaveEvent,
  DiscordMemberUpdateEvent,
} from "./discord/types";
