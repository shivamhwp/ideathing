# Ideate

A Kanban board app that syncs with Notion. Organize video ideas and automatically create entries in your Notion database when you're ready to film.

## Features

- **Kanban Board**: Two-column board with "Ideas" and "Vid It" sections
- **Notion Integration**: Connect your Notion database and sync ideas automatically
- **Drag and Drop**: Move ideas between columns with smooth animations
- **Rich Ideas**: Add titles, descriptions, thumbnails, and resource links

## Tech Stack

- **Frontend**: TanStack Start (React)
- **Backend**: Convex
- **Auth**: Clerk
- **Runtime**: Bun
- **Hosting**: Vercel

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- [Convex](https://convex.dev) account
- [Clerk](https://clerk.com) account
- [Notion](https://notion.so) account with an integration

### Installation

1. Clone the repository and install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

3. Set up Convex:

```bash
bunx convex dev
```

4. Start the development server:

```bash
bun dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CONVEX_DEPLOYMENT` | Your Convex deployment ID |
| `VITE_CONVEX_URL` | Your Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer domain |

### Notion Setup

1. Create a Notion integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a database with at least a "Name" (title) and "Status" (select) property
3. Share the database with your integration
4. Copy the database ID from the URL
5. Connect in the app using your integration token and database ID

## How It Works

1. Add ideas to the "Ideas" column with titles, descriptions, thumbnails, and resource links
2. When you're ready to film, drag an idea to the "Vid It" column
3. The app automatically creates an entry in your connected Notion database
4. The entry includes the title, description, and resource links as bookmarks

## Development

```bash
# Start development server
bun dev

# Start Convex dev server
bunx convex dev

# Build for production
bun run build
```

## Deployment

The app is configured for Vercel deployment:

```bash
vercel
```

Make sure to set up the environment variables in your Vercel project settings.
