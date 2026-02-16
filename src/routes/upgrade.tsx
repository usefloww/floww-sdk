import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import {
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  Shield,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getConfig } from "@/lib/server/config";
import { getSubscription } from "@/lib/server/billing";

export const Route = createFileRoute("/upgrade")({
  component: UpgradePage,
});

interface SubscriptionData {
  tier: "free" | "hobby" | "team";
  status: string;
  has_active_pro: boolean;
}

interface PlanInfo {
  id: "hobby" | "team";
  name: string;
  price: string;
  priceAmount: number;
  description: string;
  features: string[];
  highlight?: string;
  icon: React.ReactNode;
}

const PLANS: PlanInfo[] = [
  {
    id: "hobby",
    name: "Hobby",
    price: "€10",
    priceAmount: 10,
    description: "Perfect for solo developers and side projects",
    icon: <Zap className="h-6 w-6" />,
    features: [
      "Up to 100 workflows",
      "10,000 executions per month",
      "Priority email support",
      "All integrations included",
      "Workflow version history",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "€50",
    priceAmount: 50,
    description: "For growing teams that need more power",
    icon: <Users className="h-6 w-6" />,
    highlight: "Most popular",
    features: [
      "Up to 100 workflows",
      "50,000 executions per month",
      "Priority support",
      "All integrations included",
      "Workflow version history",
      "Team collaboration",
    ],
  },
];

function UpgradePage() {
  const navigate = useNavigate();
  const { currentNamespace } = useNamespaceStore();
  const organization = currentNamespace?.organization;

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: () => getConfig(),
  });

  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ["subscription", organization?.id],
    queryFn: () => getSubscription({ data: { organizationId: organization!.id } }),
    enabled: !!organization?.id && config?.features.billing,
  });

  // Map the server function response to the expected format
  // Backend returns UPPERCASE tiers — normalize to lowercase
  const subscription: SubscriptionData | undefined = subscriptionData ? {
    tier: subscriptionData.subscription.tier.toLowerCase() as "free" | "hobby" | "team",
    status: subscriptionData.subscription.status,
    has_active_pro: subscriptionData.plan.isPaid,
  } : undefined;

  const isOnFreePlan = subscription && !subscription.has_active_pro;
  const hasPaidPlan = subscription?.has_active_pro;
  const currentTier = subscription?.tier;

  const handleSelectPlan = (planId: "hobby" | "team") => {
    navigate({
      to: "/checkout",
      search: { plan: planId },
    });
  };

  if (!organization) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-6 text-center">
          <p className="text-amber-800 dark:text-amber-200">
            Please select an organization to view upgrade options.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate({ to: "/settings", search: { tab: "billing" } })}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Settings
      </Button>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">
            {hasPaidPlan ? "Manage your plan" : "Upgrade your plan"}
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          {hasPaidPlan
            ? "Your current plan"
            : "Choose the right plan for you"}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {hasPaidPlan
            ? "Manage your subscription."
            : "Unlock more workflows, higher execution limits, and premium features. Cancel anytime."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentTier === plan.id && subscription?.has_active_pro;
          const isRecommended = plan.id === "team";

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 transition-all ${
                isCurrentPlan
                  ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                  : isRecommended
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {isCurrentPlan ? (
                <Badge className="absolute -top-3 left-6 bg-green-500 text-white">
                  Current Plan
                </Badge>
              ) : plan.highlight ? (
                <Badge
                  className={`absolute -top-3 left-6 ${
                    isRecommended
                      ? "bg-primary text-primary-foreground"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {plan.highlight}
                </Badge>
              ) : null}

              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isCurrentPlan
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : isRecommended
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {plan.icon}
                    </div>
                    <h2 className="text-2xl font-bold">{plan.name}</h2>
                  </div>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button className="w-full" variant="outline" disabled>
                  <Check className="h-4 w-4 mr-2" />
                  Active
                </Button>
              ) : isOnFreePlan ? (
                <Button
                  className="w-full"
                  variant={isRecommended ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  Switch to {plan.name}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>Secure payments via Stripe</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <span>Instant activation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
