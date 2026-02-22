import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { handleApiError, getProviderType, createProvider, updateProvider, getOAuthAuthorizeUrl } from "@/lib/api";
import { Provider, ProviderType, ProviderSetupStep } from "@/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";
import { Loader } from "@/components/Loader";
import { CheckCircle2, Link2 } from "lucide-react";

interface ProviderConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: Provider | null; // If provided, we're editing; otherwise creating
  namespaceId: string;
  providerType?: string; // For create mode, the selected provider type
}

export function ProviderConfigModal({
  open,
  onOpenChange,
  provider,
  namespaceId,
  providerType: initialProviderType,
}: ProviderConfigModalProps) {
  const isEditMode = !!provider;
  const [selectedProviderType, setSelectedProviderType] = useState<string>(
    initialProviderType || provider?.type || ""
  );
  const [alias, setAlias] = useState(provider?.alias || "");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthConnected, setOauthConnected] = useState<Record<string, boolean>>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  // Track provider created during OAuth flow (for create+connect in one step)
  const [createdProviderId, setCreatedProviderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Handle OAuth callback messages from popup
  const handleOAuthMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'oauth_callback') {
      if (event.data.success) {
        // Mark OAuth as connected for the current step
        if (oauthLoading) {
          setOauthConnected(prev => ({ ...prev, [oauthLoading]: true }));
          queryClient.invalidateQueries({ queryKey: ["providers", namespaceId] });
          
          // If we created the provider during this flow, close the modal
          if (createdProviderId) {
            showSuccessNotification("Connected", "Provider created and connected.");
            onOpenChange(false);
          } else {
            showSuccessNotification("Connected", "OAuth connection successful.");
          }
        }
      } else {
        showErrorNotification("OAuth Failed", event.data.error || "Failed to connect.");
      }
      setOauthLoading(null);
      setCreatedProviderId(null);
    }
  }, [oauthLoading, createdProviderId, queryClient, namespaceId, onOpenChange]);

  // Set up OAuth message listener
  useEffect(() => {
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [handleOAuthMessage]);

  // Fetch provider type schema when provider type is selected
  const { data: providerTypeData, isLoading: isLoadingType } = useQuery<ProviderType | null>({
    queryKey: ["provider-type", selectedProviderType],
    queryFn: async () => {
      if (!selectedProviderType) return null;
      const data = await getProviderType(selectedProviderType);
      return data;
    },
    enabled: !!selectedProviderType && open,
  });

  // Check if OAuth is already connected based on provider config
  useEffect(() => {
    if (isEditMode && provider && providerTypeData && providerTypeData.setupSteps) {
      const connected: Record<string, boolean> = {};
      providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
        if (step.type === "oauth") {
          // Check if we have OAuth tokens in the config
          connected[step.alias] = !!(provider.config?.access_token);
        }
      });
      setOauthConnected(connected);
    }
  }, [isEditMode, provider, providerTypeData]);

  // Initialize form when provider changes or modal opens
  useEffect(() => {
    if (open) {
      if (isEditMode && provider) {
        setSelectedProviderType(provider.type);
        setAlias(provider.alias);
        // Initialize config with existing values, but mask secrets
        const initialConfig: Record<string, string> = {};
        if (providerTypeData && providerTypeData.setupSteps) {
          providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
            if (step.type === "secret" && provider.config[step.alias]) {
              // Mask existing secrets
              initialConfig[step.alias] = "••••••••";
            } else if (step.type !== "info" && step.type !== "oauth") {
              const value = provider.config[step.alias];
              initialConfig[step.alias] = (typeof value === 'string' ? value : String(value || "")) || "";
            }
          });
        } else {
          // Fallback: set all config values (will be masked once type loads)
          Object.keys(provider.config).forEach((key) => {
            const value = provider.config[key];
            initialConfig[key] = (typeof value === 'string' ? value : String(value || "")) || "";
          });
        }
        setConfig(initialConfig);
      } else {
        // Create mode
        setAlias("default");
        setConfig({});
        if (initialProviderType) {
          setSelectedProviderType(initialProviderType);
        }
      }
      setErrors({});
      setCreatedProviderId(null);
    }
  }, [open, provider, isEditMode, initialProviderType, providerTypeData]);

  // Update config when provider type data loads in edit mode
  useEffect(() => {
    if (isEditMode && provider && providerTypeData && providerTypeData.setupSteps) {
      const updatedConfig: Record<string, string> = {};
      providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
        if (step.type === "secret" && provider.config[step.alias]) {
          updatedConfig[step.alias] = "••••••••";
        } else if (step.type !== "info" && step.type !== "oauth") {
          const value = provider.config[step.alias];
          updatedConfig[step.alias] = (typeof value === 'string' ? value : String(value || "")) || "";
        }
      });
      setConfig(updatedConfig);
    }
  }, [providerTypeData, isEditMode, provider]);

  // Initialize config with defaults when provider type data loads in create mode
  useEffect(() => {
    if (!isEditMode && providerTypeData && providerTypeData.setupSteps && open) {
      setConfig((prev) => {
        const updatedConfig = { ...prev };
        let hasChanges = false;
        
        providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
          // Only set defaults for non-secret fields that don't have values yet
          if (step.type !== "secret" && step.type !== "info" && step.type !== "oauth" && step.type !== "webhook") {
            // Only set default if field doesn't exist or is empty
            if (step.default && (!prev[step.alias] || prev[step.alias] === "")) {
              updatedConfig[step.alias] = step.default;
              hasChanges = true;
            }
          }
        });
        
        return hasChanges ? updatedConfig : prev;
      });
    }
  }, [providerTypeData, isEditMode, open]);

  const createMutation = useMutation({
    mutationFn: async (data: { namespaceId: string; type: string; alias: string; config: Record<string, any> }) => {
      return await createProvider(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", namespaceId] });
      // Don't close modal or show success if we're in OAuth flow - the OAuth callback will handle it
      if (!oauthLoading) {
        showSuccessNotification("Provider created", "The provider has been created successfully.");
        onOpenChange(false);
      }
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to create provider", errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { alias?: string; config?: Record<string, any> }) => {
      if (!provider) throw new Error("Provider is required for update");
      return await updateProvider(provider.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", namespaceId] });
      showSuccessNotification("Provider updated", "The provider has been updated successfully.");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to update provider", errorMessage);
    },
  });

  // Build config object for sending to API
  const buildConfigToSend = useCallback((): Record<string, any> => {
    const configToSend: Record<string, any> = {};
    if (providerTypeData && providerTypeData.setupSteps) {
      providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
        // Skip hidden steps (showWhen condition not met)
        if (step.showWhen && config[step.showWhen.field] !== step.showWhen.value) {
          return;
        }
        if (step.type !== "info" && step.type !== "oauth") {
          // For webhook steps, include the default value if it exists
          if (step.type === "webhook") {
            const webhookUrl = provider?.config[step.alias] || step.default;
            if (webhookUrl) {
              configToSend[step.alias] = webhookUrl;
            }
            return;
          }

          const value = config[step.alias];
          // In edit mode, if it's a secret field and value is empty or masked, preserve existing
          if (isEditMode && step.type === "secret" && (!value || value === "" || value === "••••••••")) {
            // Don't include - existing value will be preserved
            return;
          }
          
          // For non-secret fields, use default if value is empty
          if (step.type !== "secret") {
            const finalValue = value && value.trim() !== "" ? value : (step.default || "");
            if (finalValue !== "") {
              configToSend[step.alias] = finalValue;
            }
          } else {
            // For secret fields, only include non-empty values (no defaults)
            if (value !== undefined && value !== "" && value !== "••••••••") {
              configToSend[step.alias] = value;
            }
          }
        }
      });
    }
    return configToSend;
  }, [providerTypeData, provider, config, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate provider type selection (create mode only)
    if (!isEditMode && !selectedProviderType) {
      setErrors({ providerType: "Provider type is required" });
      return;
    }

    // Validate alias
    if (!alias.trim()) {
      setErrors({ alias: "Alias is required" });
      return;
    }

    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (providerTypeData && providerTypeData.setupSteps) {
          providerTypeData.setupSteps.forEach((step: ProviderSetupStep) => {
        // Skip validation for hidden steps (showWhen condition not met)
        if (step.showWhen && config[step.showWhen.field] !== step.showWhen.value) {
          return;
        }
        if (step.type !== "info" && step.type !== "oauth" && step.type !== "webhook" && step.required) {
          const value = config[step.alias];
          const hasExistingSecret = isEditMode && step.type === "secret" && provider && provider.config[step.alias];
          const isMasked = hasExistingSecret && (value === "••••••••" || value === "");
          // In edit mode, masked secrets are valid (they preserve existing value)
          if (!value || (value.trim() === "" && !isMasked)) {
            newErrors[step.alias] = `${step.title} is required`;
          }
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const configToSend = buildConfigToSend();

    if (isEditMode) {
      updateMutation.mutate({
        alias: alias.trim(),
        config: Object.keys(configToSend).length > 0 ? configToSend : undefined,
      });
    } else {
      createMutation.mutate({
        namespaceId: namespaceId,
        type: selectedProviderType,
        alias: alias.trim(),
        config: configToSend,
      });
    }
  };

  const handleCancel = () => {
    setAlias("");
    setConfig({});
    setErrors({});
    setCreatedProviderId(null);
    onOpenChange(false);
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const renderSetupStep = (step: ProviderSetupStep) => {
    // Conditional visibility based on showWhen
    if (step.showWhen && config[step.showWhen.field] !== step.showWhen.value) {
      return null;
    }

    if (step.type === "info") {
      return (
        <div key={step.alias} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">{step.title}</h4>
          {step.message && <p className="text-sm text-blue-700 dark:text-blue-300">{step.message}</p>}
          {step.actionUrl && step.actionText && (
            <a
              href={step.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {step.actionText}
            </a>
          )}
        </div>
      );
    }

    if (step.type === "webhook") {
      // Use existing webhook URL from provider config, or the pre-generated default
      const configValue = provider?.config[step.alias];
      const webhookUrl = (typeof configValue === 'string' ? configValue : String(configValue || "")) || step.default || "";
      return (
        <div key={step.alias}>
          <Label htmlFor={step.alias}>{step.title}</Label>
          {step.description && (
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">{step.description}</p>
          )}
          {webhookUrl ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                id={step.alias}
                type="text"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm bg-muted cursor-default select-none opacity-75"
                onFocus={(e) => e.target.blur()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                }}
                className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1 italic">
              Webhook URL will be generated when you save this provider.
            </p>
          )}
        </div>
      );
    }

    if (step.type === "oauth") {
      const isConnected = oauthConnected[step.alias] || false;
      const isLoading = oauthLoading === step.alias;

      const handleOAuthConnect = async () => {
        // Validate alias before proceeding
        if (!alias.trim()) {
          setErrors({ alias: "Alias is required" });
          return;
        }

        // Validate provider type in create mode
        if (!isEditMode && !selectedProviderType) {
          setErrors({ providerType: "Provider type is required" });
          return;
        }

        setOauthLoading(step.alias);
        let providerId = provider?.id;

        // In create mode, create the provider first
        if (!providerId) {
          try {
            const configToSend = buildConfigToSend();
            const created = await createMutation.mutateAsync({
              namespaceId,
              type: selectedProviderType,
              alias: alias.trim(),
              config: configToSend,
            });
            if (!created?.id) {
              showErrorNotification("Error", "Failed to get provider ID after creation.");
              setOauthLoading(null);
              return;
            }
            const newProviderId = created.id as string;
            providerId = newProviderId;
            setCreatedProviderId(newProviderId);
          } catch {
            setOauthLoading(null);
            return; // Error already shown by mutation onError
          }
        }

        try {
          const { authUrl } = await getOAuthAuthorizeUrl(step.providerName!, providerId as string);

          // Open popup for OAuth flow
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          window.open(
            authUrl,
            'oauth_popup',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
          );
        } catch (error) {
          showErrorNotification("OAuth Error", handleApiError(error));
          setOauthLoading(null);
        }
      };

      return (
        <div key={step.alias} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium mb-1">{step.title}</h4>
              {step.scopes && step.scopes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Scopes: {step.scopes.join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOAuthConnect}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Connecting..."
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (step.type === "file") {
      return (
        <div key={step.alias} className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">{step.title}</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            File upload is not yet supported in the UI. Please use the CLI to configure file-based providers.
          </p>
        </div>
      );
    }

    const value = config[step.alias] || "";
    const isSecret = step.type === "secret";
    // Check if this is a masked secret (has existing value but user hasn't changed it)
    const hasExistingSecret = isEditMode && isSecret && provider && !!provider.config[step.alias];
    const isMasked: boolean = hasExistingSecret && (value === "••••••••" || value === "");
    const hasError = !!errors[step.alias];

    return (
      <div key={step.alias}>
        <Label htmlFor={step.alias}>
          {step.title}
          {step.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {step.description && (
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">{step.description}</p>
        )}
        {step.type === "choice" ? (
          <Select
            value={value}
            onValueChange={(val) => handleConfigChange(step.alias, val)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <SelectTrigger className="mt-1" aria-invalid={hasError}>
              <SelectValue placeholder={step.placeholder || `Select ${step.title.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {step.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={step.alias}
            type={isSecret ? "password" : "text"}
            value={isMasked ? "" : value}
            onChange={(e) => {
              // If it was masked and user starts typing, clear the masked marker
              const newValue = e.target.value;
              if (isMasked && newValue !== "") {
                handleConfigChange(step.alias, newValue);
              } else {
                handleConfigChange(step.alias, newValue);
              }
            }}
            placeholder={isMasked ? "•••••••• (leave empty to keep existing)" : step.placeholder || step.default || ""}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="mt-1"
            aria-invalid={hasError}
          />
        )}
        {isMasked && (
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to keep the existing value, or enter a new value to update it.
          </p>
        )}
        {hasError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors[step.alias]}</p>
        )}
      </div>
    );
  };

  const isLoading = isLoadingType || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Configure Provider" : "Create Provider"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the provider configuration. Leave secret fields empty to preserve existing values."
              : "Create a new provider by selecting a type and configuring its settings."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditMode && (
            <div>
              <Label htmlFor="providerType">
                Provider Type <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={selectedProviderType}
                onValueChange={setSelectedProviderType}
                disabled={isLoading}
              >
                <SelectTrigger className="mt-1" aria-invalid={!!errors.providerType}>
                  <SelectValue placeholder="Select a provider type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="jira">Jira</SelectItem>
                  <SelectItem value="todoist">Todoist</SelectItem>
                  <SelectItem value="google_calendar">Google Calendar</SelectItem>
                </SelectContent>
              </Select>
              {errors.providerType && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.providerType}</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="alias">
              Alias <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="alias"
              type="text"
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                if (errors.alias) {
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.alias;
                    return newErrors;
                  });
                }
              }}
              placeholder="default"
              disabled={isLoading}
              className="mt-1"
              aria-invalid={!!errors.alias}
            />
            {errors.alias && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.alias}</p>
            )}
          </div>

          <Loader isLoading={isLoadingType} loadingMessage="Loading provider configuration...">
            {providerTypeData && providerTypeData.setupSteps && providerTypeData.setupSteps.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium text-sm">Configuration</h3>
                {providerTypeData.setupSteps.map((step: ProviderSetupStep) => renderSetupStep(step))}
              </div>
            )}
            {providerTypeData && (!providerTypeData.setupSteps || providerTypeData.setupSteps.length === 0) && (
              <div className="text-sm text-muted-foreground border-t pt-4">
                This provider type requires no additional configuration.
              </div>
            )}
          </Loader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update Provider"
                : "Create Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

