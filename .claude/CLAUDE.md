# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI voice assistant platform (IntelliAA) built on top of Basejump (a Supabase SaaS starter). It provides multi-tenant voice and WhatsApp assistant management with document storage, voice synthesis, and call reporting capabilities.

**Tech Stack:**
- **Framework**: Next.js 14 (App Router with TypeScript)
- **Database**: Supabase (PostgreSQL with RLS)
- **AI Services**: Vapi (voice), ElevenLabs (voice synthesis), Flowise (document processing)
- **Infrastructure**: Railway (GraphQL backend), AWS S3 (file storage), Twilio (telephony)
- **State Management**: Apollo Client (GraphQL), SWR (data fetching)
- **UI**: Radix UI components, TailwindCSS, Recharts (analytics)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Start local Supabase (requires Docker)
supabase start
```

## Architecture Overview

### Multi-Tenant Structure

The app uses Basejump's account-based multi-tenancy:
- **Personal accounts**: Every user gets a personal account on signup
- **Team accounts**: Billable accounts shared by multiple users with role-based permissions
- **Account routing**: All main features are under `/[accountSlug]/` dynamic route

Main routes:
- `/[accountSlug]/` - Dashboard
- `/[accountSlug]/assistants` - Voice assistant management
- `/[accountSlug]/documents` - Document storage for RAG
- `/[accountSlug]/numbers` - Phone number management
- `/[accountSlug]/reports` - Call/message analytics
- `/[accountSlug]/settings` - Account settings, members, billing

### Data Flow & External Services

**Flowise Integration** ([src/services/flowiseService.ts](src/services/flowiseService.ts)):
- Handles document processing and vector storage
- Creates document stores, processes files via loaders/splitters
- Manages vector embeddings for RAG (Retrieval-Augmented Generation)
- Key operations: `createDocumentStore()`, `processFile()`, `saveVectorStore()`, `deleteLoader()`

**Vapi Integration** ([src/services/vapiService.ts](src/services/vapiService.ts)):
- Voice AI file management
- Upload/delete voice files for assistants

**Railway Integration** ([src/lib/graphqlClient.ts](src/lib/graphqlClient.ts)):
- Apollo Client configured with Railway GraphQL endpoint
- Uses `RAILWAY_URI` and `RAILWAY_TOKEN` env variables
- Backend for WhatsApp assistant deployments

### Key Data Models

**Assistants** ([src/lib/actions/intelliaa/assistants.ts](src/lib/actions/intelliaa/assistants.ts)):
- Core entity for voice/WhatsApp AI assistants
- Fields: `namespace` (unique identifier), `prompt`, `temperature`, `token`, `voice_assistant`, `docs_keys`
- Related tables: `assistants_template`, `voice_assistant`, `document_storage-assistants`
- WhatsApp deployment tracked via: `service_id_rw`, `qr_url`, `is_deploying_ws`, `activated_whatsApp`

**Documents** ([src/lib/actions/intelliaa/documents.ts](src/lib/actions/intelliaa/documents.ts)):
- Document storage system for knowledge bases
- Links to assistants via `document_storage-assistants` junction table
- Integrated with Flowise for vector embeddings

**Reports**:
- `report_ws` - WhatsApp conversation analytics
- `report_voice` - Voice call analytics
- Retrieved via [src/lib/actions/intelliaa/reports.ts](src/lib/actions/intelliaa/reports.ts)

### Supabase Client Architecture

Three client patterns:
1. **Server-side** ([src/lib/supabase/server.ts](src/lib/supabase/server.ts)) - For Server Components, uses cookies
2. **Client-side** ([src/lib/supabase/client.ts](src/lib/supabase/client.ts)) - For Client Components
3. **Middleware** ([src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts)) - Session validation via [src/middleware.ts](src/middleware.ts)

Always use the appropriate client based on component type. RLS policies enforce row-level security based on account membership.

### Authentication & Authorization

- Email/password auth via Supabase Auth
- Auth routes: `/auth/*`, `/confirm`, `/recovery-password`, `/change-password`
- Server actions in [src/app/auth/actions.ts](src/app/auth/actions.ts)
- Middleware validates sessions and handles redirects

### API Routes

Located in [src/app/api/](src/app/api/):
- `create-assistant-voice` - Create voice assistants
- `delete-assistant-voice` - Remove voice assistants
- `create-call-voice` - Initiate voice calls
- `update-assistant-voice` - Modify voice settings
- `update-assistant-number` - Link phone numbers
- `update-active-number` - Manage active numbers
- `railway` - Railway GraphQL proxy
- `send-mail-invitation` - Team invitation emails

All API routes use Next.js Route Handlers (App Router pattern).

## Important Implementation Notes

### Environment Variables

Required variables (see `.env.local` for reference):
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Flowise**: `NEXT_PUBLIC_FLOWISE`, `NEXT_PUBLIC_FLOWISE_KEY`, `NEXT_PUBLIC_FLOWISE_CHATID_PREDICTION`
- **Railway**: `RAILWAY_URI`, `RAILWAY_TOKEN`
- **AWS S3**: `NEXT_AWS_S3_ACCESS_KEY_ID`, `NEXT_AWS_S3_SECRET_ACCESS_KEY`, `NEXT_AWS_S3_BUCKET_NAME`
- **Vapi**: `NEXT_PRIVATE_VAPI_KEY`
- **ElevenLabs**: `NEXT_PUBLIC_ELEVENLABS_TOKEN`
- **Twilio**: (credentials for telephony)

### Assistant Namespace Pattern

Each assistant gets a unique `namespace` generated as:
```typescript
const namespace = `${Math.random().toString(36).substring(2, 15)}`;
```

This namespace is critical for:
- Document isolation in vector stores
- Deleting related records across tables (`documents`, `qa_docs`, `embedded_pdfs`)
- WhatsApp bot identification

### Deletion Cascades

When deleting assistants ([src/lib/actions/intelliaa/assistants.ts](src/lib/actions/intelliaa/assistants.ts:459)):
1. Delete documents by namespace: `deleteDocumentsByNamespace("documents", namespace)`
2. Delete QA records: `deleteRecordsByNamespace("qa_docs", namespace)`
3. Delete embedded PDFs: `deleteRecordsByAssistantId("embedded_pdfs", assistant_id)`
4. Delete reports: `deleteRecordsByAssistantId("report_ws", assistant_id)`
5. Call external cleanup: `deleteAssistantWs(serviceId)` (Railway)
6. Finally delete assistant record

### WhatsApp Deployment Flow

1. Call Buildship endpoint (`NEXT_PUBLIC_BUILDSHIP_URL_DEPLOY_RAILWAY`)
2. Update assistant: `is_deploying_ws: true`, `service_id_rw`, `qr_url`
3. Wait for webhook callback to set `activated_whatsApp: true`
4. Status utility: `wsStatusActiveUtil(namespace)` handles webhook updates

### Path Aliases

TypeScript paths configured in [tsconfig.json](tsconfig.json):
- `@/*` maps to `./src/*`
- Always use path aliases for imports: `import { createClient } from "@/lib/supabase/client"`

## Testing & Debugging

- Supabase local development: `supabase start` (requires Docker)
- Local DB URL: Check output of `supabase start`
- Test helpers available at Basejump repo (see README)
- GraphQL queries via Apollo Client DevTools

## Basejump Integration

This project extends Basejump's core features:
- Account management inherited from [@usebasejump/next](https://www.npmjs.com/package/@usebasejump/next)
- Components in [src/components/basejump/](src/components/basejump/)
- Actions in [src/lib/actions/](src/lib/actions/) (teams, invitations, members, billing)
- Custom Intelliaa features in [src/lib/actions/intelliaa/](src/lib/actions/intelliaa/)

See [Basejump documentation](https://usebasejump.com/docs) for:
- Creating protected tables with RLS
- Testing Supabase functions
- Billing integration with Stripe
