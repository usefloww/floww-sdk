import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { OrganizationUserManagement } from "@/components/OrganizationUserManagement";
import { ServiceAccountsManagement } from "@/components/ServiceAccountsManagement";
import { PaymentMethodCard, PaymentMethodForm } from "@/components/PaymentMethodForm";
import { InvoicesList } from "@/components/InvoicesList";
import {
  Building2,
  Shield,
  ExternalLink,
  Loader2,
  Trash2,
  AlertTriangle,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpCircle,
  Settings,
  Workflow,
  Activity,
  Users,
  Receipt,
  Settings2,
  Sparkles,
  Check,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { handleApiError } from "@/lib/api";
import { getConfig } from "@/lib/server/config";
import {
  getSubscription,
  getUsage,
  getPaymentMethod,
  cancelSubscription,
  upgradeSubscription,
} from "@/lib/server/billing";
import {
  updateOrganization,
  deleteOrganization,
  setupSSO,
} from "@/lib/server/organizations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SettingsTab = "members" | "billing" | "other";

export const Route = createFileRoute("/settings/")({
  component: OrganizationSettings,
  validateSearch: (search: Record<string, unknown>) => {
    const result: { tab: SettingsTab; checkout?: string } = {
      tab: (search.tab as SettingsTab) || "members",
    };
    if (search.checkout) {
      result.checkout = search.checkout as string;
    }
    return result;
  },
});

interface SubscriptionData {
  tier: "free" | "hobby" | "team";
  status: "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_active_pro: boolean;
}

interface UsageData {
  workflows: number;
  workflows_limit: number;
  executions_this_month: number;
  executions_limit: number;
}

interface PaymentMethodData {
  payment_method_id: string | null;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

function BillingSection({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPaymentMethodForm, setShowPaymentMethodForm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const { checkout } = Route.useSearch();

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: () => getConfig(),
  });

  const isBillingEnabled = config?.features.billing ?? false;

  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: () => getSubscription({ data: { organizationId } }),
    enabled: isBillingEnabled,
    refetchOnMount: checkout === "success" ? "always" : true,
  });

  // Map the server function response to the expected format
  // Backend returns UPPERCASE tiers/statuses (e.g. 'TEAM', 'ACTIVE') — normalize to lowercase
  const subscription: SubscriptionData | undefined = subscriptionData ? {
    tier: subscriptionData.subscription.tier.toLowerCase() as "free" | "hobby" | "team",
    status: subscriptionData.subscription.status.toLowerCase() as "active" | "past_due" | "canceled" | "incomplete",
    current_period_end: subscriptionData.subscription.currentPeriodEnd,
    grace_period_ends_at: null,
    cancel_at_period_end: subscriptionData.subscription.cancelAtPeriodEnd,
    has_active_pro: subscriptionData.plan.isPaid,
  } : undefined;

  const {
    data: usageData,
    isLoading: usageLoading,
    error: usageError,
  } = useQuery({
    queryKey: ["usage", organizationId],
    queryFn: () => getUsage({ data: { organizationId } }),
    enabled: isBillingEnabled,
  });

  // Map the server function response to the expected format
  const usage: UsageData | undefined = usageData && subscriptionData ? {
    workflows: usageData.workflows,
    workflows_limit: subscriptionData.plan.workflowLimit,
    executions_this_month: usageData.executionsThisMonth,
    executions_limit: subscriptionData.plan.executionLimitPerMonth,
  } : undefined;

  useEffect(() => {
    if (checkout === "success") {
      queryClient.invalidateQueries({ queryKey: ["subscription", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["usage", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["paymentMethod", organizationId] });

      const timer = setTimeout(() => {
        navigate({ to: "/settings", search: { tab: "billing" }, replace: true });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [checkout, organizationId, queryClient, navigate]);

  const {
    data: paymentMethodData,
    isLoading: paymentMethodLoading,
  } = useQuery({
    queryKey: ["paymentMethod", organizationId],
    queryFn: () => getPaymentMethod({ data: { organizationId } }),
    enabled: isBillingEnabled && subscription?.has_active_pro,
  });

  // Map the server function response to the expected format
  const paymentMethod: PaymentMethodData | null = paymentMethodData ? {
    payment_method_id: paymentMethodData.paymentMethodId,
    brand: paymentMethodData.brand,
    last4: paymentMethodData.last4,
    exp_month: paymentMethodData.expMonth,
    exp_year: paymentMethodData.expYear,
  } : null;

  if (!isBillingEnabled) {
    return null;
  }

  const isLoading = subscriptionLoading || usageLoading;
  const hasError = subscriptionError || usageError;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = () => {
    if (!subscription) return null;
    switch (subscription.status) {
      case "active":
        return (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "past_due":
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Canceled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-foreground hover:bg-muted">
            <AlertCircle className="h-3 w-3 mr-1" />
            {subscription.status}
          </Badge>
        );
    }
  };

  const getPlanDisplayName = (tier: string) => {
    switch (tier) {
      case "team":
        return "Team";
      case "hobby":
        return "Hobby";
      default:
        return "Free";
    }
  };

  const getStatusMessage = () => {
    if (!subscription) return null;
    if (subscription.status === "active" && subscription.current_period_end) {
      if (subscription.cancel_at_period_end) {
        return `Your subscription will end on ${formatDate(subscription.current_period_end)}`;
      }
      return `Next billing date: ${formatDate(subscription.current_period_end)}`;
    }
    if (subscription.status === "past_due" && subscription.grace_period_ends_at) {
      return `Payment failed. Access until ${formatDate(subscription.grace_period_ends_at)}`;
    }
    return null;
  };

  const handlePaymentMethodUpdate = () => {
    setShowPaymentMethodForm(false);
    queryClient.invalidateQueries({ queryKey: ["paymentMethod", organizationId] });
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setActionError(null);
    try {
      await cancelSubscription({ data: { organizationId } });
      setShowCancelDialog(false);
      queryClient.invalidateQueries({ queryKey: ["subscription", organizationId] });
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUpgradeToTeam = async () => {
    // Confirm the upgrade with the user
    const confirmed = window.confirm(
      "Upgrade to Team plan?\n\n" +
        "You'll be charged the prorated difference immediately (~€40 for the remaining days in your billing cycle). " +
        "Your next invoice will be €50/month for the Team plan."
    );
    if (!confirmed) return;

    setUpgradeLoading(true);
    setActionError(null);
    try {
      await upgradeSubscription({ data: { organizationId, targetPlan: "team" } });
      // Reload the page to refresh subscription data
      window.location.reload();
    } catch (err) {
      setActionError(handleApiError(err));
      setUpgradeLoading(false);
    }
  };

  const isOnFreePlan = subscription && !subscription.has_active_pro;
  const isOnPaidPlan = subscription?.has_active_pro;
  const isOnHobbyPlan = subscription?.tier === "hobby" && subscription?.has_active_pro;

  const workflowPercentage = usage
    ? (usage.workflows / usage.workflows_limit) * 100
    : 0;
  const executionPercentage = usage
    ? (usage.executions_this_month / usage.executions_limit) * 100
    : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-primary";
  };

  const getUsageWarning = (percentage: number, type: string) => {
    if (percentage >= 100) {
      return `You've reached your ${type} limit.`;
    }
    if (percentage >= 90) {
      return `You're approaching your ${type} limit.`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Current Plan</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading billing information...
          </div>
        ) : hasError ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
            Failed to load billing information.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subscription Status */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold">
                    {getPlanDisplayName(subscription?.tier || "free")} Plan
                  </h3>
                  {getStatusBadge()}
                </div>
                {getStatusMessage() && (
                  <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
                )}
              </div>
            </div>

            {/* Past Due Warning */}
            {subscription?.status === "past_due" && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Please update your payment method to continue using your plan features.
                </p>
              </div>
            )}

            {/* Cancel at period end notice */}
            {subscription?.cancel_at_period_end && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Your subscription will be canceled at the end of the current billing period.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Method Section (for paid users) */}
      {isOnPaidPlan && !isLoading && !hasError && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Payment Method</h2>
          </div>

          {paymentMethodLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment method...
            </div>
          ) : showPaymentMethodForm ? (
            <PaymentMethodForm
              organizationId={organizationId}
              currentPaymentMethod={paymentMethod || null}
              onUpdate={handlePaymentMethodUpdate}
              onCancel={() => setShowPaymentMethodForm(false)}
            />
          ) : (
            <PaymentMethodCard
              paymentMethod={paymentMethod || null}
              onUpdateClick={() => setShowPaymentMethodForm(true)}
            />
          )}
        </div>
      )}

      {/* Usage Stats Card */}
      {usage && !isLoading && !hasError && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Usage</h2>
          </div>

          <div className="grid gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Workflow className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">Workflows</p>
                    <p className="text-sm text-muted-foreground">
                      {usage.workflows} / {usage.workflows_limit}
                    </p>
                  </div>
                  <Progress
                    value={Math.min(workflowPercentage, 100)}
                    className="h-2"
                    indicatorClassName={getProgressColor(workflowPercentage)}
                  />
                </div>
              </div>
              {getUsageWarning(workflowPercentage, "workflow") && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 ml-8">
                  {getUsageWarning(workflowPercentage, "workflow")}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">Executions this month</p>
                    <p className="text-sm text-muted-foreground">
                      {usage.executions_this_month.toLocaleString()} /{" "}
                      {usage.executions_limit.toLocaleString()}
                    </p>
                  </div>
                  <Progress
                    value={Math.min(executionPercentage, 100)}
                    className="h-2"
                    indicatorClassName={getProgressColor(executionPercentage)}
                  />
                </div>
              </div>
              {getUsageWarning(executionPercentage, "execution") && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 ml-8">
                  {getUsageWarning(executionPercentage, "execution")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade CTA for free users */}
      {isOnFreePlan && !isLoading && !hasError && (
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-lg p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Upgrade Your Plan</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Unlock more workflows, higher execution limits, and premium features.
              </p>
              <Button onClick={() => navigate({ to: "/upgrade" })}>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                View Plans
              </Button>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-muted-foreground">Starting from</p>
              <p className="text-2xl font-bold">€10<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Plan upgrade options for Hobby users */}
      {isOnHobbyPlan && !isLoading && !hasError && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Upgrade to Team</h2>
          </div>
          {actionError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm mb-4">
              {actionError}
            </div>
          )}
          <p className="text-muted-foreground mb-4">
            Get 50,000 executions/month, team collaboration, and SSO support.
          </p>
          <div className="flex items-center gap-4">
            <Button onClick={handleUpgradeToTeam} disabled={upgradeLoading}>
              {upgradeLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade to Team (€50/mo)
                </>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              Prorated to your billing cycle
            </span>
          </div>
        </div>
      )}

      {/* Invoices Section */}
      {isOnPaidPlan && !isLoading && !hasError && (
        <InvoicesList organizationId={organizationId} />
      )}

      {/* Cancel Subscription Section */}
      {isOnPaidPlan && !isLoading && !hasError && !subscription?.cancel_at_period_end && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Ban className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Cancel Subscription</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            You can cancel your subscription at any time. Your access will continue until the end of the current billing period.
          </p>

          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Your subscription will remain active until{" "}
            <span className="font-medium text-foreground">
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : "the end of your billing cycle"}
            </span>
            . After that, you'll be downgraded to the free plan.
          </p>

          {actionError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {actionError}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelLoading}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cancel Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DangerZone({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const navigate = useNavigate();
  const { fetchNamespaces, setCurrentNamespace } = useNamespaceStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return deleteOrganization({ data: { organizationId } });
    },
    onSuccess: async () => {
      await fetchNamespaces();
      const freshNamespaces = useNamespaceStore.getState().namespaces;
      const firstNamespace = freshNamespaces[0];
      if (firstNamespace) {
        setCurrentNamespace(firstNamespace);
      }
      navigate({ to: "/" });
    },
    onError: (error) => {
      setDeleteError(handleApiError(error));
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate();
  };

  const isConfirmationValid = confirmationText === organizationName;

  return (
    <>
      <div className="bg-card border border-red-300 dark:border-red-800/50 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800/30 rounded-lg bg-red-50/50 dark:bg-red-950/20">
            <div>
              <h3 className="font-medium text-foreground">Delete this organization</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Once deleted, all workflows, providers, and data will be permanently
                removed. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="shrink-0 ml-4"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Organization
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently delete{" "}
              <strong className="text-foreground">{organizationName}</strong> and all
              its associated data including:
            </DialogDescription>
          </DialogHeader>

          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>All workflows and their execution history</li>
            <li>All provider integrations</li>
            <li>All team member access</li>
            <li>All service accounts and API keys</li>
          </ul>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">
              Type{" "}
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                {organizationName}
              </span>{" "}
              to confirm:
            </label>
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Enter organization name"
              className="font-mono"
            />
          </div>

          {deleteError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {deleteError}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfirmationText("");
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmationValid || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AuthenticationSettingsProps {
  organizationId: string;
  isTeamPlan: boolean;
}

type SetupStep = "select" | "configure" | "complete";


function AuthenticationSettings({
  organizationId,
  isTeamPlan,
}: AuthenticationSettingsProps) {
  const [setupStep, setSetupStep] = useState<SetupStep>("select");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLinkMutation = useMutation({
    mutationFn: async (features: string[]) => {
      const currentUrl = window.location.href;
      return setupSSO({
        data: {
          organizationId,
          returnUrl: currentUrl,
          successUrl: currentUrl,
          features: features.length > 0 ? features : undefined,
        },
      });
    },
    onSuccess: (data) => {
      if (data.url) {
        setPortalLink(data.url);
        setSetupStep("configure");
      }
      setError(null);
    },
    onError: (err) => {
      setError(handleApiError(err));
    },
  });

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleStartSetup = () => {
    if (selectedFeatures.length === 0) {
      setError("Please select at least one feature to configure");
      return;
    }
    setError(null);
    generateLinkMutation.mutate(selectedFeatures);
  };

  const handleCopyLink = async () => {
    if (portalLink) {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setSetupStep("select");
    setSelectedFeatures([]);
    setPortalLink(null);
    setError(null);
  };

  // If not on Team plan, show upgrade prompt
  if (!isTeamPlan) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Authentication & SSO</h2>
        </div>

        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-2">Team Plan Required</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Advanced authentication features like SSO and domain verification are available
            on the Team plan.
          </p>
          <Badge variant="secondary">Upgrade to Team to unlock</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Authentication & SSO</h2>
        </div>
        {setupStep !== "select" && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Start Over
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Feature Selection */}
      {setupStep === "select" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the authentication features you want to configure for your organization.
          </p>

          <div className="grid gap-3">
            {/* Domain Verification - Always available on Team */}
            <label
              className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                selectedFeatures.includes("domain_verification")
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFeatures.includes("domain_verification")}
                onChange={() => handleFeatureToggle("domain_verification")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Domain Verification</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Verify your company domain to automatically add users with matching email
                  addresses to your organization.
                </p>
              </div>
            </label>

            {/* SSO */}
            <label
              className={`flex items-start gap-4 p-4 border rounded-lg transition-all cursor-pointer ${
                selectedFeatures.includes("sso")
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFeatures.includes("sso")}
                onChange={() => handleFeatureToggle("sso")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Single Sign-On (SSO)</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Allow users to sign in with your company's identity provider (Okta, Azure
                  AD, Google Workspace, etc.).
                </p>
              </div>
            </label>
          </div>

          <Button
            onClick={handleStartSetup}
            disabled={selectedFeatures.length === 0 || generateLinkMutation.isPending}
            className="w-full"
          >
            {generateLinkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Continue Setup
              </>
            )}
          </Button>
        </div>
      )}

      {/* Step 2: Configuration */}
      {setupStep === "configure" && portalLink && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              Configuration Portal Ready
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              Use the link below to configure{" "}
              {selectedFeatures.map((f) => f.replace("_", " ")).join(" and ")}. You can
              share this link with your IT administrator.
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 mb-3">
              {selectedFeatures.includes("domain_verification") && (
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Domain verification setup
                </li>
              )}
              {selectedFeatures.includes("sso") && (
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  SSO provider configuration
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={portalLink}
                readOnly
                className="font-mono text-xs bg-muted/50"
              />
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(portalLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={() => window.open(portalLink, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Configuration Portal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MembersTabProps {
  organizationId: string;
  subscription: SubscriptionData | undefined;
}

function MembersTab({ organizationId, subscription }: MembersTabProps) {
  const isTeamPlan = subscription?.tier === "team" && subscription?.has_active_pro;

  return (
    <div className="space-y-6">
      <OrganizationUserManagement
        organizationId={organizationId}
        isTeamPlan={isTeamPlan}
      />
      <ServiceAccountsManagement organizationId={organizationId} />
      <AuthenticationSettings
        organizationId={organizationId}
        isTeamPlan={isTeamPlan}
      />
    </div>
  );
}

function BillingTab({ organizationId }: { organizationId: string }) {
  return (
    <div className="space-y-6">
      <BillingSection organizationId={organizationId} />
    </div>
  );
}

function OtherTab({
  organizationId,
  organizationName,
  onNameUpdated,
}: {
  organizationId: string;
  organizationName: string;
  onNameUpdated?: (newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(organizationName);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (displayName: string) => {
      return updateOrganization({ data: { organizationId, displayName } });
    },
    onSuccess: (data) => {
      setIsEditing(false);
      setUpdateError(null);
      if (onNameUpdated && data.displayName) {
        onNameUpdated(data.displayName);
      }
    },
    onError: (error) => {
      setUpdateError(handleApiError(error));
    },
  });

  const handleSave = () => {
    if (!editedName.trim()) {
      setUpdateError("Organization name cannot be empty");
      return;
    }
    if (editedName === organizationName) {
      setIsEditing(false);
      return;
    }
    setUpdateError(null);
    updateMutation.mutate(editedName.trim());
  };

  const handleCancel = () => {
    setEditedName(organizationName);
    setIsEditing(false);
    setUpdateError(null);
  };

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Organization Details</h2>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Organization Name
            </label>
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter organization name"
                  className="max-w-md"
                  autoFocus
                />
                {updateError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {updateError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-foreground">{organizationName}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="h-7 px-2"
                >
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DangerZone
        organizationId={organizationId}
        organizationName={organizationName}
      />
    </div>
  );
}

function OrganizationSettings() {
  const { currentNamespace, fetchNamespaces } = useNamespaceStore();
  const organization = currentNamespace?.organization;
  const { tab: activeTab } = Route.useSearch();

  const handleNameUpdated = async () => {
    await fetchNamespaces();
  };

  const { data: configData } = useQuery({
    queryKey: ["config"],
    queryFn: () => getConfig(),
  });

  const isBillingEnabled = configData?.features.billing ?? false;

  // Fetch subscription data for access control across tabs
  const { data: subscriptionRaw } = useQuery({
    queryKey: ["subscription", organization?.id],
    queryFn: () => getSubscription({ data: { organizationId: organization!.id } }),
    enabled: isBillingEnabled && !!organization?.id,
  });

  // Map the server function response to the expected format
  // Backend returns UPPERCASE tiers/statuses — normalize to lowercase
  const subscription: SubscriptionData | undefined = subscriptionRaw ? {
    tier: subscriptionRaw.subscription.tier.toLowerCase() as "free" | "hobby" | "team",
    status: subscriptionRaw.subscription.status.toLowerCase() as "active" | "past_due" | "canceled" | "incomplete",
    current_period_end: subscriptionRaw.subscription.currentPeriodEnd,
    grace_period_ends_at: null,
    cancel_at_period_end: subscriptionRaw.subscription.cancelAtPeriodEnd,
    has_active_pro: subscriptionRaw.plan.isPaid,
  } : undefined;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
    { id: "billing", label: "Usage & Billing", icon: <Receipt className="h-4 w-4" /> },
    { id: "other", label: "Other", icon: <Settings2 className="h-4 w-4" /> },
  ];

  if (!organization) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            No Organization Selected
          </h2>
          <p className="text-yellow-700 text-sm">
            To view and manage organization members, please select an organization from
            the workspace switcher in the sidebar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {organization.displayName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              {...({
                to: "/settings",
                search: { tab: tab.id },
                className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`
              } as any)}
            >
              <div className="flex items-center space-x-2">
                {tab.icon}
                <span>{tab.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "members" ? (
          <MembersTab organizationId={organization.id} subscription={subscription} />
        ) : activeTab === "billing" ? (
          <BillingTab organizationId={organization.id} />
        ) : activeTab === "other" ? (
          <OtherTab
            organizationId={organization.id}
            organizationName={organization.displayName}
            onNameUpdated={handleNameUpdated}
          />
        ) : null}
      </div>
    </div>
  );
}
