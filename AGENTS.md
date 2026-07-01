# AGENTS.md

## Build & Development Commands

- `bun install` — install dependencies
- `bun run dev` — start dev server (http://localhost:8080)
- `bun run build` — production build (set `NITRO_PRESET=node-server` for Docker/Node)
- `bun run lint` — run ESLint
- `bun run format` — run Prettier
- `bunx tsc --noEmit` — typecheck

## Architecture

- **Framework**: TanStack Start (Vite) + React 19 + TailwindCSS v4 + shadcn/ui
- **Routing**: TanStack file-based routing (`src/routes/`)
- **Server**: nitro node-server preset, custom entry at `src/server.ts`
- **Auth**: shared password (`SITE_PASSWORD`) + encrypted cookie session (`SESSION_SECRET`)

## Conventions

- Server-only code lives in `*.server.ts` files (Vite enforces client isolation)
- All sensitive calls go through `requireGate` middleware (unauthenticated → 401)
- Tokens are read server-side from env vars, never sent to the browser
- Do not import `*.server.ts` from client code
- `routeTree.gen.ts` is auto-generated — never edit by hand
