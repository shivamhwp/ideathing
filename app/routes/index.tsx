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
import { Lightbulb } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Ideate</h1>
            </div>
            <div className="flex items-center gap-4">
              <SignedIn>
                <NotionConnect />
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!notionConnection) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lightbulb className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Connect to Notion
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
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
    <div className="text-center py-16">
      <h2 className="text-4xl font-bold text-gray-900 mb-4">
        Turn Ideas into Videos
      </h2>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        A simple Kanban board that syncs with your Notion database. Move ideas
        from brainstorm to production with a simple drag and drop.
      </p>
      <div className="flex gap-4 justify-center mb-16">
        <SignInButton mode="modal">
          <button className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium">
            Get Started
          </button>
        </SignInButton>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
            <Lightbulb className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Capture Ideas
          </h3>
          <p className="text-gray-600">
            Add video ideas with titles, thumbnails, and resource links all in
            one place.
          </p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sync to Notion
          </h3>
          <p className="text-gray-600">
            When you're ready to film, drag to "Vid It" and it automatically
            syncs to your Notion database.
          </p>
        </div>
      </div>
    </div>
  );
}
