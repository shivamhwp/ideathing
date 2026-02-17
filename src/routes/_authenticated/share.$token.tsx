import { useOrganization } from "@clerk/tanstack-react-start";
import { ArrowLeftIcon, SpinnerIcon, StarIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTheoMode } from "@/hooks/useTheoMode";
import { cn } from "@/utils/utils";

export const Route = createFileRoute("/_authenticated/share/$token")({
  component: ShareImportPage,
});

const statusColors = {
  Concept: "bg-muted text-muted-foreground",
  "To Stream": "bg-secondary text-secondary-foreground",
  Recorded: "bg-primary text-primary-foreground",
} as const;

const getDisplayStatus = (idea: { column: string; status?: string }) => {
  if (idea.status === "Recorded") return "Recorded";
  if (idea.column === "To Stream") return "To Stream";
  return "Concept";
};

const hasTheoFields = (idea: {
  owner?: string;
  channel?: string;
  potential?: number;
  label?: string[];
  vodRecordingDate?: string;
  releaseDate?: string;
  adReadTracker?: string;
  unsponsored?: boolean;
}) =>
  Boolean(
    idea.owner ||
    idea.channel ||
    idea.vodRecordingDate ||
    idea.releaseDate ||
    idea.adReadTracker ||
    idea.label?.length ||
    idea.potential !== undefined ||
    idea.unsponsored !== undefined,
  );

function ShareIdeaCard({
  idea,
  showTheoMeta,
}: {
  idea: {
    sourceIdeaId: string;
    order: number;
    title: string;
    draftThumbnail?: string | null;
    column: string;
    status?: string;
    channel?: string;
    potential?: number;
  };
  showTheoMeta: boolean;
}) {
  const displayStatus = getDisplayStatus(idea);

  return (
    <article className="w-full rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:border-border hover:shadow-sm sm:w-[320px]">
      <div className="relative aspect-2/1 overflow-hidden bg-muted">
        {idea.draftThumbnail ? (
          <img
            src={idea.draftThumbnail}
            alt={idea.title || "Shared idea thumbnail"}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">No thumbnail</span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex min-h-[58px] flex-col gap-1.5">
        <h3 className="min-h-[32px] line-clamp-2 text-[13px] font-medium leading-tight text-foreground">
          {idea.title || "Untitled idea"}
        </h3>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className={cn("rounded px-1.5 py-0.5 font-medium", statusColors[displayStatus])}>
            {displayStatus}
          </span>
          {showTheoMeta && idea.channel ? (
            <span className="text-muted-foreground">{idea.channel.replace("C:", "")}</span>
          ) : null}
          {showTheoMeta && typeof idea.potential === "number" ? (
            <span className="ml-auto flex items-center gap-0.5 font-medium text-primary">
              <StarIcon className="h-3 w-3" weight="fill" />
              {idea.potential}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ShareImportPage() {
  const { token } = Route.useParams();
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const { isTheoMode } = useTheoMode();
  const isAdmin = membership?.role === "org:admin";
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const getSummary = useAction(api.ideas.actions.getSummary);
  const importIdeas = useAction(api.ideas.actions.importIdeas);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["share-summary", token],
    queryFn: () => getSummary({ token }),
    retry: false,
    staleTime: 30 * 1000,
  });

  const handleImport = async () => {
    if (!organization) {
      toast.error("Select an organization to import into");
      return;
    }
    if (!isAdmin) {
      toast.error("Only organization admins can import ideas");
      return;
    }

    setIsImporting(true);
    try {
      const result = await importIdeas({ token });
      setImportedCount(result.itemCount);
      toast.success("Ideas imported");
    } catch (error) {
      void error;
      toast.error("Failed to import ideas");
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading || !isOrgLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <WarningCircleIcon className="mx-auto h-10 w-10 text-amber-500" weight="fill" />
          <h1 className="text-lg font-semibold">Link is invalid or expired</h1>
          <p className="text-sm text-muted-foreground">
            Ask the sender to generate a new share link.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to board</Link>
          </Button>
        </div>
      </div>
    );
  }

  const canImport = Boolean(organization && isAdmin && importedCount === null && !isImporting);
  const previewIdeas = summary.previewIdeas ?? [];
  // const expirationLabel = new Date(summary.expiresAt).toLocaleString();
  const createdAtLabel = new Date(summary.createdAt).toLocaleString();

  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to board
            </Link>
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-h-0 rounded-xl border border-border bg-card/50 p-3 backdrop-blur">
            {previewIdeas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-7 text-center text-sm text-muted-foreground">
                No ideas available in this share.
              </div>
            ) : (
              <div className="h-full overflow-y-auto pr-1">
                <div className="flex flex-wrap content-start gap-4">
                  {previewIdeas.map((idea) => (
                    <ShareIdeaCard
                      key={`${idea.sourceIdeaId}-${idea.order}`}
                      idea={idea}
                      showTheoMeta={isTheoMode || hasTheoFields(idea)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="min-h-0 rounded-xl border border-border/70 bg-card/60 p-3 shadow-md backdrop-blur">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Import destination</h2>
                <p className="text-sm text-muted-foreground">
                  {summary.itemCount} idea{summary.itemCount === 1 ? "" : "s"} shared on{" "}
                  {createdAtLabel}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Target organization</p>
                <p className="text-sm font-medium">
                  {organization?.name ?? "No organization selected"}
                </p>
              </div>

              {importedCount !== null ? (
                <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  Imported {importedCount} idea{importedCount === 1 ? "" : "s"} into{" "}
                  {organization?.name ?? "your organization"}.
                </div>
              ) : null}

              {!organization ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Select an organization before importing.
                </div>
              ) : null}

              {organization && !isAdmin ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Only organization admins can complete this import.
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/">Cancel</Link>
                </Button>
                <Button onClick={handleImport} disabled={!canImport} className="flex-1">
                  {isImporting ? (
                    <span className="inline-flex items-center gap-2">
                      <SpinnerIcon className="h-4 w-4 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    "Import ideas"
                  )}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
