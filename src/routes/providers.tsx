import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { handleApiError } from "@/lib/api";
import { Provider } from "@/types/api";
import { getProviders } from "@/lib/server/providers";
import { Loader } from "@/components/Loader";
import { Search, Building2, CheckCircle, XCircle, Clock, MoreVertical, Settings, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderConfigModal } from "@/components/ProviderConfigModal";
import { DeleteProviderDialog } from "@/components/DeleteProviderDialog";
import { ProviderAccessManagement } from "@/components/ProviderAccessManagement";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Provider logo mapping to Simple Icons CDN
const getProviderLogoUrl = (type: string): string | null => {
  const iconMap: Record<string, string> = {
    'ai': 'openai',
    'aws': 'amazonaws',
    'gcp': 'googlecloud',
    'googlecloud': 'googlecloud',
    'azure': 'microsoftazure',
    'microsoftazure': 'microsoftazure',
    'github': 'github',
    'gitlab': 'gitlab',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'terraform': 'terraform',
    'slack': 'slack',
    'discord': 'discord',
    'jenkins': 'jenkins',
    'circleci': 'circleci',
    'githubactions': 'githubactions',
  };

  const iconName = iconMap[type.toLowerCase()];
  if (!iconName) return null;
  
  return `https://cdn.simpleicons.org/${iconName}`;
};

export const Route = createFileRoute("/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  const { currentNamespace } = useNamespaceStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // Use TanStack Query to fetch providers
  const { data, isLoading, error } = useQuery({
    queryKey: ['providers', currentNamespace?.id],
    queryFn: async () => {
      const data = await getProviders({ data: { namespaceId: currentNamespace?.id } });
      return Array.isArray(data?.results) ? data.results : [];
    },
  });

  const providers = data || [];
  const errorMessage = error ? handleApiError(error) : null;

  const filteredProviders = Array.isArray(providers)
    ? providers.filter(provider =>
        (provider?.alias || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider?.type?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleConfigure = (provider: Provider) => {
    setSelectedProvider(provider);
    setEditModalOpen(true);
  };

  const handleDelete = (provider: Provider) => {
    setSelectedProvider(provider);
    setDeleteDialogOpen(true);
  };

  const handleManageAccess = (provider: Provider) => {
    setSelectedProvider(provider);
    setAccessModalOpen(true);
  };

  const handleAccessModalClose = (open: boolean) => {
    setAccessModalOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  const handleCreateClick = () => {
    setSelectedProvider(null);
    setCreateModalOpen(true);
  };

  const handleEditModalClose = (open: boolean) => {
    setEditModalOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Providers</h1>
          <Button onClick={handleCreateClick}>
            Create Provider
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Providers table */}
      <Loader isLoading={isLoading} loadingMessage="Loading providers...">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No providers</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? "No providers match your search." : "No providers found in this namespace."}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    onConfigure={() => handleConfigure(provider)}
                    onDelete={() => handleDelete(provider)}
                    onManageAccess={() => handleManageAccess(provider)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Loader>

      {/* Modals */}
      {currentNamespace && (
        <>
          <ProviderConfigModal
            open={createModalOpen}
            onOpenChange={handleCreateModalClose}
            namespaceId={currentNamespace.id}
          />
          <ProviderConfigModal
            open={editModalOpen}
            onOpenChange={handleEditModalClose}
            provider={selectedProvider}
            namespaceId={currentNamespace.id}
          />
          <DeleteProviderDialog
            open={deleteDialogOpen}
            onOpenChange={handleDeleteDialogClose}
            provider={selectedProvider}
            namespaceId={currentNamespace.id}
          />
          {selectedProvider && currentNamespace.organization && (
            <ProviderAccessManagement
              open={accessModalOpen}
              onOpenChange={handleAccessModalClose}
              providerId={selectedProvider.id}
              providerName={selectedProvider.alias || selectedProvider.type}
              organizationId={currentNamespace.organization.id}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ProviderRowProps {
  provider: Provider;
  onConfigure: () => void;
  onDelete: () => void;
  onManageAccess: () => void;
}

function ProviderRow({ provider, onConfigure, onDelete, onManageAccess }: ProviderRowProps) {
  const providerName = provider.alias || provider.name || 'Unnamed Provider';
  const formattedDate = provider.createdAt 
    ? new Date(provider.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : '—';
  const lastUsedDate = provider.lastUsedAt 
    ? new Date(provider.lastUsedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'Never';
  const status = 'connected';
  const logoUrl = getProviderLogoUrl(provider.type);
  const [imageError, setImageError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Reset image error when provider or logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [provider.id, logoUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
      case 'disconnected':
        return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
      case 'pending':
        return <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
      case 'disconnected':
        return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
      case 'pending':
        return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
      default:
        return 'text-foreground bg-muted';
    }
  };

  return (
    <TableRow className="group">
      {/* Logo */}
      <TableCell className="w-[50px]">
        <div className="flex items-center justify-center">
          {logoUrl && !imageError ? (
            <img
              src={logoUrl}
              alt={provider.type}
              className="h-6 w-6 object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      </TableCell>

      {/* Name */}
      <TableCell>
        <span className="font-medium text-foreground">{providerName}</span>
      </TableCell>

      {/* Type */}
      <TableCell>
        <span className="text-muted-foreground uppercase text-sm">{provider.type}</span>
      </TableCell>

      {/* Created */}
      <TableCell className="text-muted-foreground text-sm">
        {formattedDate}
      </TableCell>

      {/* Last Used */}
      <TableCell className="text-muted-foreground text-sm">
        {lastUsedDate}
      </TableCell>

      {/* Status */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          {getStatusIcon(status)}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(status)}`}>
            {status}
          </span>
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setDropdownOpen(false);
                onConfigure();
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDropdownOpen(false);
                onManageAccess();
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Access
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDropdownOpen(false);
                onDelete();
              }}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}