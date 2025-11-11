/**
 * Discord REST API v10 Client
 * Handles all HTTP requests to Discord API with rate limiting and error handling
 */

import {
  DiscordApiConfig,
  DiscordAPIError,
  DiscordChannel,
  DiscordError,
  DiscordMember,
  DiscordMessage,
  DiscordUser,
  RateLimitInfo,
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
} from './types';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * Rate limit bucket for a specific route
 */
class RateLimitBucket {
  limit: number = 0;
  remaining: number = 0;
  reset: number = 0;
  resetAfter: number = 0;

  update(info: RateLimitInfo): void {
    this.limit = info.limit;
    this.remaining = info.remaining;
    this.reset = info.reset * 1000; // Convert to milliseconds
    this.resetAfter = info.resetAfter * 1000;
  }

  shouldWait(): number {
    if (this.remaining === 0) {
      const waitTime = this.reset - Date.now();
      if (waitTime > 0) {
        return waitTime;
      }
    }
    return 0;
  }
}

/**
 * Rate limiter for Discord API
 */
class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private globalReset: number = 0;

  async wait(route: string): Promise<void> {
    // Check global rate limit
    if (this.globalReset > Date.now()) {
      const waitTime = this.globalReset - Date.now();
      await this.sleep(waitTime);
    }

    // Check route-specific rate limit
    const bucket = this.buckets.get(route);
    if (bucket) {
      const waitTime = bucket.shouldWait();
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }
  }

  updateFromHeaders(route: string, headers: Headers): void {
    const bucket = this.getBucket(route);

    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const resetAfter = headers.get('x-ratelimit-reset-after');
    const global = headers.get('x-ratelimit-global');

    if (global === 'true') {
      const retryAfter = headers.get('retry-after');
      if (retryAfter) {
        this.globalReset = Date.now() + parseFloat(retryAfter) * 1000;
      }
    }

    if (limit && remaining && reset && resetAfter) {
      bucket.update({
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseFloat(reset),
        resetAfter: parseFloat(resetAfter),
      });
    }
  }

  private getBucket(route: string): RateLimitBucket {
    if (!this.buckets.has(route)) {
      this.buckets.set(route, new RateLimitBucket());
    }
    return this.buckets.get(route)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Discord API Client
 */
export class DiscordApi {
  private botToken: string;
  private rateLimiter: RateLimiter;

  constructor(config: DiscordApiConfig) {
    this.botToken = config.botToken;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Make an HTTP request to Discord API
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    options: {
      body?: any;
      query?: Record<string, string | number | boolean>;
      files?: Array<{ name: string; data: Buffer | Uint8Array; contentType?: string }>;
      reason?: string;
    } = {}
  ): Promise<T> {
    const url = new URL(`${DISCORD_API_BASE}${endpoint}`);

    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Extract route for rate limiting (remove IDs for bucket matching)
    const route = this.extractRoute(endpoint);

    // Wait for rate limit
    await this.rateLimiter.wait(route);

    // Prepare headers
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.botToken}`,
    };

    if (options.reason) {
      headers['X-Audit-Log-Reason'] = encodeURIComponent(options.reason);
    }

    let body: string | FormData | undefined;

    // Handle file uploads with multipart/form-data
    if (options.files && options.files.length > 0) {
      const formData = new FormData();

      // Add files
      options.files.forEach((file, index) => {
        const blob = new Blob([file.data], { type: file.contentType || 'application/octet-stream' });
        formData.append(`files[${index}]`, blob, file.name);
      });

      // Add JSON payload
      if (options.body) {
        formData.append(
          'payload_json',
          JSON.stringify({
            ...options.body,
            attachments: options.files.map((file, index) => ({
              id: index,
              filename: file.name,
            })),
          })
        );
      }

      body = formData;
    } else if (options.body) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    // Make request with retry logic
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers,
          body,
        });

        // Update rate limit info
        this.rateLimiter.updateFromHeaders(route, response.headers);

        // Handle rate limit (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            const waitTime = parseFloat(retryAfter) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // Retry
          }
        }

        // Handle successful responses
        if (response.ok) {
          // Some endpoints return 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }

          const data = await response.json();
          return data as T;
        }

        // Handle error responses
        let errorData: DiscordAPIError;
        try {
          errorData = (await response.json()) as DiscordAPIError;
        } catch {
          errorData = { code: 0, message: response.statusText };
        }
        throw DiscordError.fromResponse(response.status, errorData);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx except 429)
        if (error instanceof DiscordError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }

        // Exponential backoff for server errors
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Extract route for rate limiting bucket matching
   * Removes IDs and replaces them with placeholders
   */
  private extractRoute(endpoint: string): string {
    return endpoint
      .replace(/\/\d{17,19}/g, '/:id') // Replace snowflake IDs
      .replace(/\/reactions\/[^/]+/g, '/reactions/:emoji');
  }

  // ============================================================================
  // Message Methods
  // ============================================================================

  async sendMessage(args: SendMessageArgs): Promise<DiscordMessage> {
    if (!args.content && (!args.embeds || args.embeds.length === 0) && (!args.files || args.files.length === 0)) {
      throw new Error('Message must have content, embeds, or files');
    }

    const body: any = {};

    if (args.content) body.content = args.content;
    if (args.embeds) body.embeds = args.embeds;
    if (args.components) body.components = args.components;
    if (args.tts) body.tts = args.tts;
    if (args.allowed_mentions) body.allowed_mentions = args.allowed_mentions;
    if (args.message_reference) body.message_reference = args.message_reference;

    return this.request<DiscordMessage>('POST', `/channels/${args.channelId}/messages`, {
      body,
      files: args.files,
    });
  }

  async sendDirectMessage(args: SendDirectMessageArgs): Promise<DiscordMessage> {
    // First, create a DM channel with the user
    const dmChannel = await this.request<DiscordChannel>('POST', '/users/@me/channels', {
      body: { recipient_id: args.userId },
    });

    // Then send the message
    return this.sendMessage({
      channelId: dmChannel.id,
      content: args.content,
      embeds: args.embeds,
      files: args.files,
    });
  }

  async editMessage(args: EditMessageArgs): Promise<DiscordMessage> {
    const body: any = {};

    if (args.content !== undefined) body.content = args.content;
    if (args.embeds !== undefined) body.embeds = args.embeds;
    if (args.components !== undefined) body.components = args.components;

    return this.request<DiscordMessage>('PATCH', `/channels/${args.channelId}/messages/${args.messageId}`, {
      body,
    });
  }

  async deleteMessage(args: DeleteMessageArgs): Promise<void> {
    return this.request<void>('DELETE', `/channels/${args.channelId}/messages/${args.messageId}`);
  }

  async getMessage(args: GetMessageArgs): Promise<DiscordMessage> {
    return this.request<DiscordMessage>('GET', `/channels/${args.channelId}/messages/${args.messageId}`);
  }

  async getMessages(args: GetMessagesArgs): Promise<DiscordMessage[]> {
    const query: Record<string, string | number> = {};

    if (args.limit) query.limit = args.limit;
    if (args.before) query.before = args.before;
    if (args.after) query.after = args.after;
    if (args.around) query.around = args.around;

    return this.request<DiscordMessage[]>('GET', `/channels/${args.channelId}/messages`, { query });
  }

  // ============================================================================
  // Reaction Methods
  // ============================================================================

  async addReaction(args: AddReactionArgs): Promise<void> {
    const emoji = encodeURIComponent(args.emoji);
    return this.request<void>('PUT', `/channels/${args.channelId}/messages/${args.messageId}/reactions/${emoji}/@me`);
  }

  async removeReaction(args: RemoveReactionArgs): Promise<void> {
    const emoji = encodeURIComponent(args.emoji);
    const userPath = args.userId ? `/${args.userId}` : '/@me';
    return this.request<void>(
      'DELETE',
      `/channels/${args.channelId}/messages/${args.messageId}/reactions/${emoji}${userPath}`
    );
  }

  // ============================================================================
  // Channel Methods
  // ============================================================================

  async createChannel(args: CreateChannelArgs): Promise<DiscordChannel> {
    const body: any = {
      name: args.name,
    };

    if (args.type !== undefined) body.type = args.type;
    if (args.topic) body.topic = args.topic;
    if (args.bitrate) body.bitrate = args.bitrate;
    if (args.user_limit) body.user_limit = args.user_limit;
    if (args.rate_limit_per_user) body.rate_limit_per_user = args.rate_limit_per_user;
    if (args.position) body.position = args.position;
    if (args.permission_overwrites) body.permission_overwrites = args.permission_overwrites;
    if (args.parent_id) body.parent_id = args.parent_id;
    if (args.nsfw !== undefined) body.nsfw = args.nsfw;

    return this.request<DiscordChannel>('POST', `/guilds/${args.guildId}/channels`, { body });
  }

  async updateChannel(args: UpdateChannelArgs): Promise<DiscordChannel> {
    const body: any = {};

    if (args.name) body.name = args.name;
    if (args.type !== undefined) body.type = args.type;
    if (args.position !== undefined) body.position = args.position;
    if (args.topic !== undefined) body.topic = args.topic;
    if (args.nsfw !== undefined) body.nsfw = args.nsfw;
    if (args.rate_limit_per_user !== undefined) body.rate_limit_per_user = args.rate_limit_per_user;
    if (args.bitrate !== undefined) body.bitrate = args.bitrate;
    if (args.user_limit !== undefined) body.user_limit = args.user_limit;
    if (args.permission_overwrites) body.permission_overwrites = args.permission_overwrites;
    if (args.parent_id !== undefined) body.parent_id = args.parent_id;
    if (args.rtc_region !== undefined) body.rtc_region = args.rtc_region;
    if (args.video_quality_mode !== undefined) body.video_quality_mode = args.video_quality_mode;
    if (args.default_auto_archive_duration !== undefined)
      body.default_auto_archive_duration = args.default_auto_archive_duration;

    return this.request<DiscordChannel>('PATCH', `/channels/${args.channelId}`, { body });
  }

  async deleteChannel(args: DeleteChannelArgs): Promise<void> {
    return this.request<void>('DELETE', `/channels/${args.channelId}`);
  }

  async getChannel(args: GetChannelArgs): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('GET', `/channels/${args.channelId}`);
  }

  async listChannels(args: ListChannelsArgs): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>('GET', `/guilds/${args.guildId}/channels`);
  }

  // ============================================================================
  // Member & Role Methods
  // ============================================================================

  async addRole(args: AddRoleArgs): Promise<void> {
    return this.request<void>('PUT', `/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`, {
      reason: args.reason,
    });
  }

  async removeRole(args: RemoveRoleArgs): Promise<void> {
    return this.request<void>('DELETE', `/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`, {
      reason: args.reason,
    });
  }

  async getMember(args: GetMemberArgs): Promise<DiscordMember> {
    return this.request<DiscordMember>('GET', `/guilds/${args.guildId}/members/${args.userId}`);
  }

  async listMembers(args: ListMembersArgs): Promise<DiscordMember[]> {
    const query: Record<string, string | number> = {};

    if (args.limit) query.limit = args.limit;
    if (args.after) query.after = args.after;

    return this.request<DiscordMember[]>('GET', `/guilds/${args.guildId}/members`, { query });
  }

  async kickMember(args: KickMemberArgs): Promise<void> {
    return this.request<void>('DELETE', `/guilds/${args.guildId}/members/${args.userId}`, {
      reason: args.reason,
    });
  }

  async banMember(args: BanMemberArgs): Promise<void> {
    const body: any = {};

    if (args.delete_message_days !== undefined) body.delete_message_days = args.delete_message_days;
    if (args.delete_message_seconds !== undefined) body.delete_message_seconds = args.delete_message_seconds;

    return this.request<void>('PUT', `/guilds/${args.guildId}/bans/${args.userId}`, {
      body,
      reason: args.reason,
    });
  }

  async unbanMember(args: UnbanMemberArgs): Promise<void> {
    return this.request<void>('DELETE', `/guilds/${args.guildId}/bans/${args.userId}`, {
      reason: args.reason,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async getCurrentUser(): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', '/users/@me');
  }

  async getUser(userId: string): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', `/users/${userId}`);
  }
}
