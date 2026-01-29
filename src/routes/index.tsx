import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NotionConnect } from "@/components/NotionConnect";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			<div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
				<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
							Notion → Vid It
						</p>
						<h1 className="text-3xl md:text-4xl font-semibold text-foreground">
							Idea board that turns into Notion tasks
						</h1>
						<p className="text-sm md:text-base text-muted-foreground max-w-2xl">
							Connect a Notion database, collect ideas with resources and
							thumbnails, then move items to “Vid It” to create a new entry in
							your target Notion section.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<NotionConnect />
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-xl border border-border bg-card/60 p-4">
						<p className="text-xs text-muted-foreground">Step 1</p>
						<p className="text-sm font-medium text-foreground mt-1">
							Connect your Notion database
						</p>
					</div>
					<div className="rounded-xl border border-border bg-card/60 p-4">
						<p className="text-xs text-muted-foreground">Step 2</p>
						<p className="text-sm font-medium text-foreground mt-1">
							Add ideas with resources & thumbnails
						</p>
					</div>
					<div className="rounded-xl border border-border bg-card/60 p-4">
						<p className="text-xs text-muted-foreground">Step 3</p>
						<p className="text-sm font-medium text-foreground mt-1">
							Move to “Vid It” to sync to Notion
						</p>
					</div>
				</div>

				<KanbanBoard />
			</div>
		</div>
	);
}
