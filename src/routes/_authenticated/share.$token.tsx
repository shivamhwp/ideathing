import { useOrganization } from "@clerk/tanstack-react-start";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/share/$token")({
  component: ShareImportPage,
});

function ShareImportPage() {
  const { token } = Route.useParams();
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const isAdmin = membership?.role === "org:admin";
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const getSummary = useAction(api.ideaExports.getSummary);
  const importIdeas = useAction(api.ideaExports.importIdeas);
  const [summary, setSummary] = useState<{
    itemCount: number;
    createdAt: number;
    expiresAt: number;
    sourceOrganizationId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void (async () => {
      try {
        const result = await getSummary({ token });
        if (mounted) {
          setSummary(result ?? null);
        }
      } catch (error) {
        void error;
        if (mounted) {
          setSummary(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getSummary, token]);

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
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Loading share link...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md space-y-3 text-center">
          <WarningCircleIcon className="w-10 h-10 text-amber-500 mx-auto" weight="fill" />
          <h1 className="text-lg font-semibold">Link is invalid or expired</h1>
          <p className="text-sm text-muted-foreground">
            Ask the sender to generate a new share link.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to board</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-8 h-8 text-primary" weight="fill" />
          <div>
            <h1 className="text-lg font-semibold">Import shared ideas</h1>
            <p className="text-sm text-muted-foreground">
              This link shares {summary.itemCount} idea
              {summary.itemCount === 1 ? "" : "s"} and expires on{" "}
              {new Date(summary.expiresAt).toLocaleString()}.
            </p>
          </div>
        </div>

        {importedCount !== null ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            Imported {importedCount} idea{importedCount === 1 ? "" : "s"} into{" "}
            {organization?.name ?? "your organization"}.
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              You will import into:{" "}
              <span className="font-medium text-foreground">
                {organization?.name ?? "No organization selected"}
              </span>
            </p>
            {!isAdmin && organization ? (
              <p className="text-amber-500">
                Only organization admins can complete this import.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <Button asChild variant="outline">
            <Link to="/">Back</Link>
          </Button>
          <Button
            onClick={handleImport}
            disabled={!organization || !isAdmin || isImporting || importedCount !== null}
          >
            {isImporting ? "Importing..." : "Import ideas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
