import { useOrganization, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { CopyIcon, InfoIcon, LinkIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const exportsQuery = convexQuery(api.ideas.queries.listExportsForUser, {});

export const Route = createFileRoute("/_authenticated/settings/shared")({
  component: SharedLinksSettings,
});

function SharedLinksSettings() {
  const { isSignedIn } = useUser();
  const { organization, isLoaded } = useOrganization();
  const canQueryExports = isLoaded && isSignedIn && Boolean(organization);
  const { data: exports, isLoading } = useQuery({
    ...exportsQuery,
    enabled: canQueryExports,
  });
  const queryClient = useQueryClient();
  const revokeExport = useMutation(api.ideas.mutations.revokeExport);

  if (!isLoaded) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <p className="text-sm text-muted-foreground">Loading shared links...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <WarningCircleIcon className="w-5 h-5" />
          <p>You need to be part of an organization to view shared links.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <p className="text-sm text-muted-foreground">Loading shared links...</p>
      </div>
    );
  }

  if (!exports || exports.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <LinkIcon className="w-5 h-5" />
          <p>No shared links yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full divide-y divide-border/40 border border-border/40">
      {exports.map((record) => {
        const link = record.shareUrl ?? "Link unavailable";
        const createdLabel = new Date(record.createdAt).toLocaleString();
        const expiresLabel = new Date(record.expiresAt).toLocaleString();
        const usageLabel = `${record.uses}/${record.maxUses} used`;

        return (
          <div
            key={record._id}
            className="group flex items-center gap-3 px-2 py-3 transition-colors hover:bg-primary/10"
          >
            <div className="relative min-w-0 flex-1">
              <div className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-sm text-muted-foreground/70">
                {link}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="pointer-events-auto flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 cursor-pointer text-muted-foreground hover:text-primary"
                        onClick={async () => {
                          if (!record.shareUrl) return;
                          await navigator.clipboard.writeText(link);
                        }}
                        aria-label="Copy link"
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 cursor-pointer text-muted-foreground hover:text-primary"
                        aria-label="Share link details"
                      >
                        <InfoIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="space-y-1">
                      <div>Created {createdLabel}</div>
                      <div>Expires {expiresLabel}</div>
                      <div>{usageLabel}</div>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 cursor-pointer text-muted-foreground hover:text-red-500"
                        aria-label="Delete link"
                        onClick={async () => {
                          await revokeExport({ exportId: record._id });
                          await queryClient.invalidateQueries(exportsQuery);
                        }}
                      >
                        <TrashIcon className="size-4" weight="bold" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete link</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
