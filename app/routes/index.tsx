import { createFileRoute } from "@tanstack/react-router";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/tanstack-start";
import { KanbanBoard } from "~/components/KanbanBoard";
import { NotionConnect } from "~/components/NotionConnect";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Lightbulb, VideoCamera } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-primary to-pink-400 rounded-md flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-white" weight="fill" />
              </div>
              <h1 className="text-base font-semibold text-foreground">
                Ideate
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <SignedIn>
                <NotionConnect />
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="sm">Sign In</Button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <SignedIn>
          <AuthenticatedContent />
        </SignedIn>
        <SignedOut>
          <LandingContent />
        </SignedOut>
      </main>
    </div>
  );
}

function AuthenticatedContent() {
  const notionConnection = useQuery(api.notion.getConnection);

  if (notionConnection === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!notionConnection) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
          <Lightbulb
            className="w-7 h-7 text-muted-foreground"
            weight="duotone"
          />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Connect to Notion
        </h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
          Connect your Notion database to start organizing your ideas and track
          what to video next.
        </p>
        <NotionConnect />
      </div>
    );
  }

  return <KanbanBoard />;
}

function LandingContent() {
  return (
    <div className="text-center py-12">
      <h2 className="text-3xl font-bold text-foreground mb-3">
        Turn Ideas into Videos
      </h2>
      <p className="text-base text-muted-foreground mb-6 max-w-xl mx-auto">
        A simple Kanban board that syncs with your Notion database. Move ideas
        from brainstorm to production with a simple drag and drop.
      </p>
      <div className="flex gap-3 justify-center mb-12">
        <SignInButton mode="modal">
          <Button size="lg">Get Started</Button>
        </SignInButton>
      </div>

      <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-5">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600" weight="fill" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5">
              Capture Ideas
            </h3>
            <p className="text-xs text-muted-foreground">
              Add video ideas with titles, thumbnails, and resource links all in
              one place.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center mb-3">
              <VideoCamera className="w-5 h-5 text-pink-600" weight="fill" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5">
              Sync to Notion
            </h3>
            <p className="text-xs text-muted-foreground">
              When you're ready to film, drag to "Vid It" and it automatically
              syncs to your Notion database.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
