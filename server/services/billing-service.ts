/**
 * Billing Service
 *
 * Handles subscription management, plan limits, and usage tracking.
 */

import { eq, and, sql, gte, inArray } from 'drizzle-orm';
import { getDb } from '~/server/db';
import {
  subscriptions,
  billingEvents,
  workflows,
  executionHistory,
  namespaces,
  type Subscription,
} from '~/server/db/schema';
import { generateUlidUuid } from '~/server/utils/uuid';
import { settings } from '~/server/settings';

export type SubscriptionTier = 'FREE' | 'HOBBY' | 'TEAM';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  planName: string;
  workflowLimit: number;
  executionLimitPerMonth: number;
  isPaid: boolean;
}

// Plan limits: [workflowLimit, executionLimitPerMonth]
const PLAN_LIMITS: Record<SubscriptionTier, [number, number]> = {
  FREE: [3, 100],
  HOBBY: [100, 10_000],
  TEAM: [100, 50_000],
};

const PLAN_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  HOBBY: 'Hobby',
  TEAM: 'Team',
};

// Settings from environment
const IS_CLOUD = settings.general.IS_CLOUD;
const TRIAL_PERIOD_DAYS = settings.stripe.TRIAL_PERIOD_DAYS;
const GRACE_PERIOD_DAYS = settings.stripe.GRACE_PERIOD_DAYS;

function isSubscriptionActive(subscription: Subscription): boolean {
  if (subscription.tier === 'FREE') {
    return false;
  }

  const now = new Date();

  if (subscription.status === 'TRIALING') {
    return subscription.trialEndsAt ? subscription.trialEndsAt > now : false;
  }

  if (subscription.status === 'ACTIVE') {
    return true;
  }

  if (subscription.status === 'PAST_DUE') {
    return subscription.gracePeriodEndsAt ? subscription.gracePeriodEndsAt > now : false;
  }

  return false;
}

/**
 * Get subscription details including plan limits
 */
export function getSubscriptionDetails(subscription: Subscription): SubscriptionDetails {
  const isPaid = isSubscriptionActive(subscription);

  if (isPaid) {
    const tier = subscription.tier;
    const [workflowLimit, executionLimit] = PLAN_LIMITS[tier];
    return {
      tier,
      planName: PLAN_NAMES[tier],
      workflowLimit,
      executionLimitPerMonth: executionLimit,
      isPaid: true,
    };
  }

  const [workflowLimit, executionLimit] = PLAN_LIMITS.FREE;
  return {
    tier: 'FREE',
    planName: PLAN_NAMES.FREE,
    workflowLimit,
    executionLimitPerMonth: executionLimit,
    isPaid: false,
  };
}

/**
 * Get or create a subscription for an organization
 */
export async function getOrCreateSubscription(organizationId: string): Promise<Subscription> {
  const db = getDb();

  // Check for existing subscription
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new free subscription
  try {
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        id: generateUlidUuid(),
        organizationId,
        tier: 'FREE',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      })
      .returning();

    return subscription;
  } catch (error) {
    // Handle race condition - another process may have created the subscription
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    if (!existing) {
      throw new Error(`Failed to create or find subscription for organization ${organizationId}`);
    }

    return existing;
  }
}

/**
 * Get workflow count for an organization
 */
export async function getWorkflowCount(organizationId: string): Promise<number> {
  const db = getDb();

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflows)
    .innerJoin(namespaces, eq(workflows.namespaceId, namespaces.id))
    .where(eq(namespaces.organizationOwnerId, organizationId));

  return result?.count ?? 0;
}

/**
 * Get execution count for current month
 */
export async function getExecutionCountThisMonth(organizationId: string): Promise<number> {
  const db = getDb();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionHistory)
    .innerJoin(workflows, eq(executionHistory.workflowId, workflows.id))
    .innerJoin(namespaces, eq(workflows.namespaceId, namespaces.id))
    .where(
      and(
        eq(namespaces.organizationOwnerId, organizationId),
        gte(executionHistory.receivedAt, startOfMonth),
        inArray(executionHistory.status, ['COMPLETED', 'STARTED', 'RECEIVED'])
      )
    );

  return result?.count ?? 0;
}

/**
 * Check if organization can create more workflows
 */
export async function checkWorkflowLimit(
  organizationId: string
): Promise<{ allowed: boolean; message: string }> {
  if (!IS_CLOUD) {
    return { allowed: true, message: '' };
  }

  const subscription = await getOrCreateSubscription(organizationId);
  const details = getSubscriptionDetails(subscription);
  const currentCount = await getWorkflowCount(organizationId);

  if (currentCount >= details.workflowLimit) {
    if (details.isPaid) {
      return {
        allowed: false,
        message: `You have reached your workflow limit of ${details.workflowLimit} workflows.`,
      };
    }
    return {
      allowed: false,
      message: `You have reached the free tier limit of ${details.workflowLimit} workflows. Upgrade to Hobby to create more workflows.`,
    };
  }

  return { allowed: true, message: '' };
}

/**
 * Check if organization can execute more workflows
 */
export async function checkExecutionLimit(
  organizationId: string
): Promise<{ allowed: boolean; message: string }> {
  if (!IS_CLOUD) {
    return { allowed: true, message: '' };
  }

  const subscription = await getOrCreateSubscription(organizationId);
  const details = getSubscriptionDetails(subscription);
  const currentCount = await getExecutionCountThisMonth(organizationId);

  if (currentCount >= details.executionLimitPerMonth) {
    if (details.isPaid) {
      return {
        allowed: false,
        message: `You have reached your monthly execution limit of ${details.executionLimitPerMonth.toLocaleString()} executions.`,
      };
    }
    return {
      allowed: false,
      message: `You have reached the free tier limit of ${details.executionLimitPerMonth.toLocaleString()} executions this month. Upgrade to Hobby for more executions.`,
    };
  }

  return { allowed: true, message: '' };
}

/**
 * Start a trial for a subscription
 */
export async function startTrial(
  subscriptionId: string,
  trialEndsAt?: Date
): Promise<void> {
  const db = getDb();

  const trialEnd = trialEndsAt ?? new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(subscriptions)
    .set({
      tier: 'HOBBY',
      status: 'TRIALING',
      trialEndsAt: trialEnd,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

/**
 * Activate a paid subscription
 */
export async function activatePaidSubscription(
  subscriptionId: string,
  stripeSubscriptionId: string,
  currentPeriodEnd: Date
): Promise<void> {
  const db = getDb();

  await db
    .update(subscriptions)
    .set({
      status: 'ACTIVE',
      stripeSubscriptionId,
      currentPeriodEnd,
      trialEndsAt: null,
      gracePeriodEndsAt: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const db = getDb();

  await db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

/**
 * Start grace period for past due subscription
 */
export async function startGracePeriod(subscriptionId: string): Promise<void> {
  const db = getDb();

  const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(subscriptions)
    .set({
      status: 'PAST_DUE',
      gracePeriodEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

/**
 * Downgrade to free tier
 */
export async function downgradeToFree(subscriptionId: string): Promise<void> {
  const db = getDb();

  await db
    .update(subscriptions)
    .set({
      tier: 'FREE',
      status: 'ACTIVE',
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

/**
 * Check if a Stripe event is a duplicate
 */
async function isDuplicateEvent(stripeEventId: string): Promise<boolean> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, stripeEventId))
    .limit(1);

  return !!existing;
}

/**
 * Record a billing event
 */
async function recordEvent(
  subscriptionId: string,
  eventType: string,
  stripeEventId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();

  await db.insert(billingEvents).values({
    id: generateUlidUuid(),
    subscriptionId,
    eventType,
    stripeEventId,
    payload,
  });
}

/**
 * Handle Stripe checkout.session.completed webhook
 */
export async function handleCheckoutCompleted(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const metadata = (eventData.metadata ?? {}) as Record<string, string>;
  const subscriptionIdStr = metadata.subscription_id;

  if (!subscriptionIdStr) {
    return;
  }

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionIdStr))
    .limit(1);

  if (!subscription) {
    return;
  }

  // Update customer ID if not set
  const stripeCustomerId = eventData.customer as string | undefined;
  if (stripeCustomerId && !subscription.stripeCustomerId) {
    await db
      .update(subscriptions)
      .set({ stripeCustomerId })
      .where(eq(subscriptions.id, subscription.id));
  }

  await recordEvent(subscription.id, 'checkout.session.completed', stripeEventId, eventData);
}

/**
 * Handle Stripe customer.subscription.created webhook
 */
export async function handleSubscriptionCreated(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const metadata = (eventData.metadata ?? {}) as Record<string, string>;
  const subscriptionIdStr = metadata.subscription_id;

  if (!subscriptionIdStr) {
    return;
  }

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionIdStr))
    .limit(1);

  if (!subscription) {
    return;
  }

  const stripeSubscriptionId = eventData.id as string;
  const currentPeriodEndTs = eventData.current_period_end as number | undefined;
  const currentPeriodEnd = currentPeriodEndTs
    ? new Date(currentPeriodEndTs * 1000)
    : null;
  const trialEndTs = eventData.trial_end as number | undefined;
  const trialEnd = trialEndTs ? new Date(trialEndTs * 1000) : null;
  const stripeStatus = eventData.status as string;

  if (stripeStatus === 'TRIALING') {
    await startTrial(subscription.id, trialEnd ?? undefined);
    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId,
        currentPeriodEnd,
      })
      .where(eq(subscriptions.id, subscription.id));
  } else if (
    ['ACTIVE', 'PAST_DUE'].includes(stripeStatus) &&
    stripeSubscriptionId &&
    currentPeriodEnd
  ) {
    await activatePaidSubscription(subscription.id, stripeSubscriptionId, currentPeriodEnd);
  }

  // Sync tier from subscription items
  const items = ((eventData.items as Record<string, unknown>)?.data ?? []) as Array<{
    price?: { id?: string };
  }>;
  const priceIdHobby = settings.stripe.STRIPE_PRICE_ID_HOBBY;
  const priceIdTeam = settings.stripe.STRIPE_PRICE_ID_TEAM;

  for (const item of items) {
    const priceId = item.price?.id;
    if (priceId === priceIdHobby) {
      await db.update(subscriptions).set({ tier: 'HOBBY' }).where(eq(subscriptions.id, subscription.id));
    } else if (priceId === priceIdTeam) {
      await db.update(subscriptions).set({ tier: 'TEAM' }).where(eq(subscriptions.id, subscription.id));
    }
  }

  await recordEvent(subscription.id, 'customer.subscription.created', stripeEventId, eventData);
}

/**
 * Handle Stripe customer.subscription.updated webhook
 */
export async function handleSubscriptionUpdated(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const stripeSubscriptionId = eventData.id as string;

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    return;
  }

  const stripeStatus = eventData.status as string;
  const currentPeriodEndTs = eventData.current_period_end as number | undefined;
  const currentPeriodEnd = currentPeriodEndTs ? new Date(currentPeriodEndTs * 1000) : null;
  const cancelAtPeriodEnd = (eventData.cancel_at_period_end as boolean) ?? false;

  const updateData: Record<string, unknown> = {
    currentPeriodEnd,
    cancelAtPeriodEnd,
    updatedAt: new Date(),
  };

  if (stripeStatus === 'ACTIVE') {
    updateData.status = 'ACTIVE';
    updateData.gracePeriodEndsAt = null;
  } else if (stripeStatus === 'PAST_DUE') {
    updateData.status = 'PAST_DUE';
  } else if (stripeStatus === 'CANCELED') {
    await downgradeToFree(subscription.id);
    await recordEvent(subscription.id, 'customer.subscription.updated', stripeEventId, eventData);
    return;
  }

  await db.update(subscriptions).set(updateData).where(eq(subscriptions.id, subscription.id));

  // Sync tier from subscription items
  if (stripeStatus !== 'CANCELED') {
    const items = ((eventData.items as Record<string, unknown>)?.data ?? []) as Array<{
      price?: { id?: string };
    }>;
    const priceIdHobby = settings.stripe.STRIPE_PRICE_ID_HOBBY;
    const priceIdTeam = settings.stripe.STRIPE_PRICE_ID_TEAM;

    for (const item of items) {
      const priceId = item.price?.id;
      if (priceId === priceIdHobby) {
        await db.update(subscriptions).set({ tier: 'HOBBY' }).where(eq(subscriptions.id, subscription.id));
      } else if (priceId === priceIdTeam) {
        await db.update(subscriptions).set({ tier: 'TEAM' }).where(eq(subscriptions.id, subscription.id));
      }
    }
  }

  await recordEvent(subscription.id, 'customer.subscription.updated', stripeEventId, eventData);
}

/**
 * Handle Stripe customer.subscription.deleted webhook
 */
export async function handleSubscriptionDeleted(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const stripeSubscriptionId = eventData.id as string;

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    return;
  }

  await downgradeToFree(subscription.id);
  await recordEvent(subscription.id, 'customer.subscription.deleted', stripeEventId, eventData);
}

/**
 * Handle Stripe invoice.payment_failed webhook
 */
export async function handlePaymentFailed(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const stripeSubscriptionId = eventData.subscription as string | undefined;
  if (!stripeSubscriptionId) {
    return;
  }

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    return;
  }

  await startGracePeriod(subscription.id);
  await recordEvent(subscription.id, 'invoice.payment_failed', stripeEventId, eventData);
}

/**
 * Handle Stripe invoice.payment_succeeded webhook
 */
export async function handlePaymentSucceeded(
  eventData: Record<string, unknown>,
  stripeEventId: string
): Promise<void> {
  if (await isDuplicateEvent(stripeEventId)) {
    return;
  }

  const parent = eventData.parent as Record<string, unknown> | undefined;
  const subscriptionDetails = parent?.subscription_details as Record<string, unknown> | undefined;
  const stripeSubscriptionId = subscriptionDetails?.subscription as string | undefined;

  if (!stripeSubscriptionId) {
    return;
  }

  const db = getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    return;
  }

  // If was past due, reactivate
  if (subscription.status === 'PAST_DUE') {
    await db
      .update(subscriptions)
      .set({
        status: 'ACTIVE',
        gracePeriodEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));
  }

  await recordEvent(subscription.id, 'invoice.payment_succeeded', stripeEventId, eventData);
}
