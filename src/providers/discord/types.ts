/**
 * Discord Integration Type Definitions
 * Based on Discord API v10
 */

// ============================================================================
// Core Discord Types
// ============================================================================

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string;
  accent_color?: number;
  locale?: string;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

export interface DiscordMember {
  user?: DiscordUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string;
}

export interface DiscordChannel {
  id: string;
  type: DiscordChannelType;
  guild_id?: string;
  position?: number;
  permission_overwrites?: DiscordPermissionOverwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: DiscordUser[];
  icon?: string;
  owner_id?: string;
  application_id?: string;
  parent_id?: string;
  last_pin_timestamp?: string;
  rtc_region?: string;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: any;
  member?: any;
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
}

export enum DiscordChannelType {
  GUILD_TEXT = 0,
  DM = 1,
  GUILD_VOICE = 2,
  GROUP_DM = 3,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  ANNOUNCEMENT_THREAD = 10,
  PUBLIC_THREAD = 11,
  PRIVATE_THREAD = 12,
  GUILD_STAGE_VOICE = 13,
  GUILD_DIRECTORY = 14,
  GUILD_FORUM = 15,
}

export interface DiscordPermissionOverwrite {
  id: string;
  type: 0 | 1; // 0 = role, 1 = member
  allow: string;
  deny: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: DiscordUser[];
  mention_roles: string[];
  mention_channels?: any[];
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions?: DiscordReaction[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  activity?: any;
  application?: any;
  application_id?: string;
  message_reference?: any;
  flags?: number;
  referenced_message?: DiscordMessage;
  interaction?: any;
  thread?: DiscordChannel;
  components?: DiscordComponent[];
  sticker_items?: any[];
  position?: number;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
  ephemeral?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  image?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  thumbnail?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  video?: {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  provider?: {
    name?: string;
    url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export interface DiscordComponent {
  type: number;
  custom_id?: string;
  disabled?: boolean;
  style?: number;
  label?: string;
  emoji?: DiscordEmoji;
  url?: string;
  options?: any[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  components?: DiscordComponent[];
}

export interface DiscordEmoji {
  id?: string;
  name: string;
  roles?: string[];
  user?: DiscordUser;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface DiscordReaction {
  count: number;
  me: boolean;
  emoji: DiscordEmoji;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string;
  unicode_emoji?: string;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: any;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  icon_hash?: string;
  splash?: string;
  discovery_splash?: string;
  owner?: boolean;
  owner_id: string;
  permissions?: string;
  region?: string;
  afk_channel_id?: string;
  afk_timeout: number;
  widget_enabled?: boolean;
  widget_channel_id?: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: DiscordRole[];
  emojis: DiscordEmoji[];
  features: string[];
  mfa_level: number;
  application_id?: string;
  system_channel_id?: string;
  system_channel_flags: number;
  rules_channel_id?: string;
  max_presences?: number;
  max_members?: number;
  vanity_url_code?: string;
  description?: string;
  banner?: string;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  public_updates_channel_id?: string;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  welcome_screen?: any;
  nsfw_level: number;
  stickers?: any[];
  premium_progress_bar_enabled: boolean;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export type DiscordEventType =
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_REACTION_ADD'
  | 'MESSAGE_REACTION_REMOVE'
  | 'GUILD_MEMBER_ADD'
  | 'GUILD_MEMBER_REMOVE'
  | 'GUILD_MEMBER_UPDATE';

export interface DiscordWebhookEvent {
  t: DiscordEventType;
  d: any;
  s?: number;
  op: number;
}

export interface DiscordMessageEvent {
  type: 'MESSAGE_CREATE' | 'MESSAGE_UPDATE';
  guild_id?: string;
  channel_id: string;
  message: DiscordMessage;
}

export interface DiscordReactionEvent {
  type: 'MESSAGE_REACTION_ADD' | 'MESSAGE_REACTION_REMOVE';
  guild_id?: string;
  channel_id: string;
  message_id: string;
  user_id: string;
  emoji: DiscordEmoji;
  member?: DiscordMember;
}

export interface DiscordMemberJoinEvent {
  type: 'GUILD_MEMBER_ADD';
  guild_id: string;
  user: DiscordUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf?: boolean;
  mute?: boolean;
  flags: number;
  pending?: boolean;
}

export interface DiscordMemberLeaveEvent {
  type: 'GUILD_MEMBER_REMOVE';
  guild_id: string;
  user: DiscordUser;
}

export interface DiscordMemberUpdateEvent {
  type: 'GUILD_MEMBER_UPDATE';
  guild_id: string;
  roles: string[];
  user: DiscordUser;
  nick?: string;
  avatar?: string;
  joined_at?: string;
  premium_since?: string;
  deaf?: boolean;
  mute?: boolean;
  pending?: boolean;
  communication_disabled_until?: string;
}

// ============================================================================
// Trigger Input Types
// ============================================================================

export interface DiscordOnMessageInput {
  guild_id?: string;
  channel_id?: string;
  user_id?: string;
  include_bots?: boolean;
  include_edits?: boolean;
}

export interface DiscordOnReactionInput {
  guild_id?: string;
  channel_id?: string;
  emoji?: string;
  user_id?: string;
}

export interface DiscordOnMemberJoinInput {
  guild_id?: string;
}

export interface DiscordOnMemberLeaveInput {
  guild_id?: string;
}

export interface DiscordOnMemberUpdateInput {
  guild_id?: string;
  track_roles?: boolean;
  track_nickname?: boolean;
}

// ============================================================================
// Action Parameter Types
// ============================================================================

export interface SendMessageArgs {
  channelId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  tts?: boolean;
  files?: Array<{
    name: string;
    data: Buffer | Uint8Array;
    contentType?: string;
  }>;
  allowed_mentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: string[];
    users?: string[];
    replied_user?: boolean;
  };
  message_reference?: {
    message_id: string;
    channel_id?: string;
    guild_id?: string;
    fail_if_not_exists?: boolean;
  };
}

export interface SendDirectMessageArgs {
  userId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  files?: Array<{
    name: string;
    data: Buffer | Uint8Array;
    contentType?: string;
  }>;
}

export interface EditMessageArgs {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
}

export interface DeleteMessageArgs {
  channelId: string;
  messageId: string;
}

export interface GetMessageArgs {
  channelId: string;
  messageId: string;
}

export interface GetMessagesArgs {
  channelId: string;
  limit?: number;
  before?: string;
  after?: string;
  around?: string;
}

export interface AddReactionArgs {
  channelId: string;
  messageId: string;
  emoji: string;
}

export interface RemoveReactionArgs {
  channelId: string;
  messageId: string;
  emoji: string;
  userId?: string;
}

export interface CreateChannelArgs {
  guildId: string;
  name: string;
  type?: DiscordChannelType;
  topic?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  position?: number;
  permission_overwrites?: DiscordPermissionOverwrite[];
  parent_id?: string;
  nsfw?: boolean;
}

export interface UpdateChannelArgs {
  channelId: string;
  name?: string;
  type?: DiscordChannelType;
  position?: number;
  topic?: string;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
  permission_overwrites?: DiscordPermissionOverwrite[];
  parent_id?: string;
  rtc_region?: string;
  video_quality_mode?: number;
  default_auto_archive_duration?: number;
}

export interface DeleteChannelArgs {
  channelId: string;
}

export interface GetChannelArgs {
  channelId: string;
}

export interface ListChannelsArgs {
  guildId: string;
}

export interface AddRoleArgs {
  guildId: string;
  userId: string;
  roleId: string;
  reason?: string;
}

export interface RemoveRoleArgs {
  guildId: string;
  userId: string;
  roleId: string;
  reason?: string;
}

export interface GetMemberArgs {
  guildId: string;
  userId: string;
}

export interface ListMembersArgs {
  guildId: string;
  limit?: number;
  after?: string;
}

export interface KickMemberArgs {
  guildId: string;
  userId: string;
  reason?: string;
}

export interface BanMemberArgs {
  guildId: string;
  userId: string;
  reason?: string;
  delete_message_days?: number;
  delete_message_seconds?: number;
}

export interface UnbanMemberArgs {
  guildId: string;
  userId: string;
  reason?: string;
}

export interface CreateEmbedArgs {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: string;
  image?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  url?: string;
  timestamp?: string;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface DiscordAPIError {
  code: number;
  message: string;
  errors?: any;
}

export class DiscordError extends Error {
  constructor(
    message: string,
    public code?: number,
    public statusCode?: number,
    public errors?: any
  ) {
    super(message);
    this.name = 'DiscordError';
  }

  static fromResponse(status: number, data: DiscordAPIError): DiscordError {
    const message = data.message || 'Unknown Discord API error';
    return new DiscordError(message, data.code, status, data.errors);
  }
}

// ============================================================================
// Rate Limit Types
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  resetAfter: number;
  bucket?: string;
  global?: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DiscordConfig {
  credential?: string;
  botToken?: string;
}

export interface DiscordApiConfig {
  botToken: string;
}
