# Dashboard Implementation Plan

## Overview

Build a full-featured, **aesthetically modern** dashboard for DEBT-OS using **Next.js 14** with App Router, **Tailwind CSS**, and **shadcn/ui** components.

## Design Philosophy

### Visual Principles
- **Dark-first design** with light mode support
- **Glassmorphism** effects for cards and modals (backdrop blur, subtle transparency)
- **Soft shadows** and smooth border radius (rounded-xl, rounded-2xl)
- **Gradient accents** for CTAs and highlights
- **Micro-interactions** on hover, focus, and click
- **Generous whitespace** for breathing room

### Color Palette (Dark Theme)
```
Background:     #0a0a0b (near black)
Surface:        #18181b (zinc-900)
Surface Hover:  #27272a (zinc-800)
Border:         #3f3f46 (zinc-700)
Text Primary:   #fafafa (zinc-50)
Text Secondary: #a1a1aa (zinc-400)
Accent:         #6366f1 (indigo-500) → #8b5cf6 (violet-500) gradient
Success:        #22c55e (green-500)
Warning:        #f59e0b (amber-500)
Error:          #ef4444 (red-500)
Info:           #3b82f6 (blue-500)
```

### Severity Colors
```
Critical:  #dc2626 (red-600) with red glow
High:      #f97316 (orange-500)
Medium:    #eab308 (yellow-500)
Low:       #3b82f6 (blue-500)
Info:      #6b7280 (gray-500)
```

### Typography
- Font: Inter (clean, modern sans-serif)
- Headings: Semi-bold (600)
- Body: Regular (400)
- Monospace: JetBrains Mono for code

### Component Styling
```css
/* Cards */
.card {
  background: rgba(24, 24, 27, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(63, 63, 70, 0.5);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

/* Buttons */
.button-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

/* Hover states */
.interactive:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

### Animation Guidelines
- Page transitions: fade + subtle slide (200ms)
- Card hover: scale(1.01) with shadow lift
- Button press: scale(0.98) tactile feedback
- Loading: pulse skeleton with gradient shimmer
- Charts: staggered entrance animations
- Progress bars: smooth spring animation

### Layout Patterns
- Sidebar: 240px fixed, collapsible to 64px icons
- Content area: max-w-7xl centered with side padding
- Card grid: responsive 1/2/3/4 columns
- Data tables: sticky headers, alternating row tints

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Charts | Recharts |
| Tables | TanStack Table |
| State | React Query (TanStack Query) |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Animations | Framer Motion |
| Syntax Highlighting | Shiki (for code evidence) |

## Project Structure

```
apps/dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with sidebar
│   │   ├── page.tsx            # Dashboard home (overview)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── repos/
│   │   │   ├── page.tsx        # Repository list
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Repository detail
│   │   │       └── scans/
│   │   │           └── [scanId]/
│   │   │               └── page.tsx  # Scan detail
│   │   ├── debt/
│   │   │   ├── page.tsx        # All debt items
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Debt item detail
│   │   └── settings/
│   │       └── page.tsx        # User settings & API keys
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav-item.tsx
│   │   ├── charts/
│   │   │   ├── severity-chart.tsx
│   │   │   ├── trend-chart.tsx
│   │   │   └── hotspot-chart.tsx
│   │   ├── repos/
│   │   │   ├── repo-card.tsx
│   │   │   ├── repo-list.tsx
│   │   │   └── connect-repo-dialog.tsx
│   │   ├── scans/
│   │   │   ├── scan-list.tsx
│   │   │   ├── scan-progress.tsx   # SSE real-time progress
│   │   │   └── trigger-scan-button.tsx
│   │   └── debt/
│   │       ├── debt-table.tsx
│   │       ├── debt-filters.tsx
│   │       ├── debt-card.tsx
│   │       └── severity-badge.tsx
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Auth utilities
│   │   └── utils.ts            # Helpers
│   ├── hooks/
│   │   ├── use-repos.ts
│   │   ├── use-scans.ts
│   │   ├── use-debt.ts
│   │   └── use-scan-progress.ts  # SSE hook
│   └── types/
│       └── index.ts            # TypeScript types
├── public/
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

## Implementation Steps

### Step 1: Project Setup
1. Create Next.js app in `apps/dashboard`
2. Configure Tailwind CSS
3. Initialize shadcn/ui with components: button, card, dialog, dropdown-menu, input, label, select, table, tabs, badge, avatar, skeleton
4. Set up API client with fetch + React Query
5. Configure environment variables for API URL

### Step 2: Authentication
1. Create login page with GitHub OAuth button
2. Implement auth callback handler
3. Add auth middleware for protected routes
4. Create user context/provider
5. Add logout functionality

### Step 3: Layout & Navigation
1. Build responsive sidebar with navigation
2. Create header with user menu
3. Implement mobile-friendly hamburger menu
4. Add breadcrumb navigation

### Step 4: Dashboard Home (Overview)
1. Stats cards: total repos, total debt items, critical count, recent scans
2. Severity distribution pie chart
3. Debt type breakdown bar chart
4. Recent activity list
5. Quick actions: connect repo, trigger scan

### Step 5: Repository Management
1. Repository list with cards showing:
   - Name, provider icon
   - Last scan date
   - Debt count by severity
   - Sync/scan status
2. Connect repository dialog (GitHub OAuth flow)
3. Repository detail page:
   - Settings panel
   - Scan history table
   - Debt summary charts
4. Trigger scan button with branch selector

### Step 6: Scan Management
1. Scan list with status badges
2. Real-time progress using SSE:
   - Progress bar
   - Files analyzed counter
   - Debt items found
   - Estimated time remaining
3. Scan detail page:
   - Stats summary
   - Debt items found in this scan
   - File analysis breakdown

### Step 7: Debt Items
1. Filterable data table:
   - Columns: severity, type, title, file, status, confidence
   - Filters: severity[], type[], status[], file path search
   - Sorting by any column
   - Pagination
2. Debt item detail page:
   - Full description
   - Code evidence with syntax highlighting
   - Git blame info (who introduced, when)
   - Suggested fix
   - Effort estimate
   - Status update dropdown

### Step 8: Analytics & Charts
1. Trends over time line chart (debt count over scans)
2. Hotspots bar chart (files with most debt)
3. Severity breakdown donut chart
4. Type distribution horizontal bar chart
5. Date range selector for trend analysis

### Step 9: Settings
1. API key management:
   - Create new key with scopes
   - List existing keys (show prefix only)
   - Revoke keys
2. User profile display
3. Repository settings (bulk update)

### Step 10: Polish & Testing
1. Loading skeletons for all data
2. Error boundaries and error states
3. Empty states with helpful CTAs
4. Responsive design testing
5. Accessibility audit

## API Integration

The dashboard will consume these existing endpoints:

| Feature | Endpoints |
|---------|-----------|
| Auth | `GET /auth/github`, `GET /auth/me` |
| Repos | `GET/POST /repos`, `GET/PATCH/DELETE /repos/:id` |
| Scans | `POST /repos/:id/scans`, `GET /scans/:id`, `GET /scans/:id/progress` (SSE) |
| Debt | `GET /repos/:id/debt`, `GET /debt/:id`, `PATCH /debt/:id` |
| Analytics | `GET /repos/:id/debt/trends`, `GET /repos/:id/debt/hotspots` |
| API Keys | `GET/POST/DELETE /api-keys` |

## Package Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.0.0",
    "recharts": "^2.10.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "lucide-react": "^0.294.0",
    "framer-motion": "^10.16.0",
    "shiki": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "next-themes": "^0.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0"
  }
}
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=DEBT-OS
```

## Monorepo Integration

Add to root `package.json` workspaces:
```json
"workspaces": ["apps/*", "libs/*"]
```

Add npm scripts:
```json
"dashboard:dev": "npm run dev -w apps/dashboard",
"dashboard:build": "npm run build -w apps/dashboard"
```

## Estimated Effort

| Step | Components | Effort |
|------|------------|--------|
| 1. Setup | Project scaffolding | Small |
| 2. Auth | Login, callback, middleware | Small |
| 3. Layout | Sidebar, header, nav | Small |
| 4. Home | Stats, charts, activity | Medium |
| 5. Repos | List, detail, connect | Medium |
| 6. Scans | List, SSE progress, detail | Medium |
| 7. Debt | Table, filters, detail | Large |
| 8. Analytics | Charts, trends, hotspots | Medium |
| 9. Settings | API keys, profile | Small |
| 10. Polish | Loading, errors, responsive | Medium |

## Success Criteria

- [ ] User can login via GitHub OAuth
- [ ] User can view list of connected repositories
- [ ] User can connect a new repository
- [ ] User can trigger a scan and see real-time progress
- [ ] User can view and filter debt items
- [ ] User can see debt trends and hotspots
- [ ] User can update debt item status
- [ ] User can manage API keys
- [ ] Dashboard is responsive on mobile
- [ ] All loading and error states handled
