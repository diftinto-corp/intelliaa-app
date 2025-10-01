# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI voice assistant platform (IntelliAA) built on top of Basejump (a Supabase SaaS starter). It provides multi-tenant voice and WhatsApp assistant management with document storage, voice synthesis, and call reporting capabilities.

**Tech Stack:**
- **Framework**: Next.js 15.5.4 (App Router with TypeScript, Turbopack enabled)
- **Runtime**: React 19.1.1
- **Database**: Supabase (PostgreSQL with RLS)
- **Supabase SSR**: v0.5.2 (async API support)
- **AI Services**: Vapi (voice), ElevenLabs (voice synthesis), Flowise (document processing)
- **Infrastructure**: Railway (GraphQL backend), AWS S3 (file storage), Twilio (telephony)
- **State Management**: Apollo Client (GraphQL), SWR (data fetching)
- **UI**: Radix UI components, TailwindCSS, Recharts (analytics)

## Development Commands

```bash
# Install dependencies (uses --legacy-peer-deps due to some packages not yet supporting React 19)
npm install --legacy-peer-deps

# Start development server with Turbopack (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Start local Supabase (requires Docker)
supabase start
```

## Important: Next.js 15 Breaking Changes

This project was migrated from Next.js 14 to 15.5.4 with React 19. Key changes to be aware of:

### 1. Async Request APIs
- **`cookies()`** is now async in Server Components and Route Handlers
- **`params`** in pages/layouts is now `Promise<{ ... }>`
- **`searchParams`** in pages is now `Promise<{ ... }>`

**Examples:**
```typescript
// Server Component - Supabase client
export const createClient = async () => {
  const cookieStore = await cookies(); // MUST await
  return createServerClient(...)
}

// Page with params
export default async function Page({
  params,
}: {
  params: Promise<{ accountSlug: string }>; // Promise type
}) {
  const { accountSlug } = await params; // MUST await
  const supabase = await createClient(); // MUST await
}
```

### 2. Client Component Restrictions
- Cannot import server-only functions like `revalidatePath`, `cookies`, `headers` in Client Components
- Dynamic imports with `ssr: false` are not allowed in Server Components
- Move to Client Component with `"use client"` directive if needed

### 3. Hydration Considerations
- Theme-dependent rendering (dark/light mode) must use `mounted` state to avoid hydration mismatches
- Empty `src` attributes cause warnings - use conditionals: `{url && <audio src={url} />}`

### 4. TypeScript Strictness
- React 19 has stricter `RefObject` types
- `RefObject<HTMLElement>` may need `| null` to accept `useRef<HTMLElement>(null)`

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

Specialized Implementation Planning Agents

This project utilizes specialized Claude Code agents for comprehensive implementation planning across different technologies and domains. Each agent is designed to analyze requirements, create detailed implementation plans, and document architectural decisions without performing actual implementation.

Available Specialized Agents:

🚀 nextjs-planner
When to use: For Next.js framework upgrades, App Router optimization, and React architecture planning

Handles Next.js 14 to 15+ migrations
Optimizes Server/Client component boundaries
Plans routing and middleware configurations
Addresses performance and bundle optimization
Documents breaking changes and upgrade paths

🎨 shadcn-ui-planner
When to use: For UI component updates, design system evolution, and component architecture

Manages shadcn/ui version upgrades
Plans component migration and compatibility
Optimizes theme configuration and design tokens
Ensures accessibility compliance
Designs responsive layouts and mobile experience

🤖 vercel-ai-sdk-architect
When to use: For AI integration, RAG implementation, and document processing workflows

Designs RAG architecture to replace existing solutions
Plans document processing pipelines with embeddings
Implements vector search and retrieval systems
Optimizes AI model interactions and token usage
Creates scalable document storage and indexing

📱 Eevolution-api-architect
When to use: For WhatsApp integration, messaging workflows, and communication platform migrations

Replaces Railway/Buildship with Evolution API
Manages WhatsApp instance deployment and configuration
Implements message routing and webhook systems
Plans multi-tenant messaging architecture
Designs QR code generation and session management

🎙️ vapi-implementation-planner
When to use: For voice AI integration, telephony systems, and conversational AI workflows

Manages VAPI voice assistant configurations
Plans phone number provisioning and Twilio integration
Implements call routing and transfer rule logic
Optimizes voice quality and latency performance
Designs analytics and reporting for voice interactions

🗄️ supabase-architect
When to use: For database migrations, schema changes, and data architecture optimization

Plans Supabase and PostgreSQL optimizations
Designs Row Level Security (RLS) policies
Manages database schema migrations
Optimizes query performance and indexing
Plans data synchronization between services

🏗️ architecture-planner
When to use: For system-wide architectural decisions, service integration, and scalability planning

Designs overall system architecture for migrations
Plans integration between different services and APIs
Evaluates authentication system alternatives (Basejump vs Clerk)
Optimizes multi-tenant data access patterns
Ensures security and performance across integrations

🧪 testing-strategy-planner
When to use: For comprehensive testing strategy, automated testing, and quality assurance planning

Designs testing strategies for migrations and new features
Plans unit, integration, and end-to-end tests
Creates mocking strategies for external services
Implements performance and load testing scenarios
Designs test data management and cleanup procedures

✅ qa-criteria-validator
When to use: For defining acceptance criteria, quality gates, and validation frameworks

Establishes acceptance criteria using Given-When-Then format
Creates quality gates and validation checkpoints
Performs risk assessment and mitigation planning
Defines performance benchmarks and SLA requirements
Plans rollback criteria and emergency procedures


# WORKFLOW RULES

### Phase 1

- At the starting point of a feature on plan mode phase you MUST ALWAYS init a `.claude/sessions/context_session_{feature_name}.md` with your first analysis
- You MUST ask to the subagents that you considered that have to be involved about the implementation and check their opinions, try always to run them on parallel if is possible
- After a plan mode phase you ALWAYS update the `.claude/sessions/context_session_{feature_name}.md` with the definition of the plan and the recomendations of the subagents

### Phase 2

- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file to get the full context (x being the id of the session we are operate, if file doesn't exist, then create one)
- `.claude/sessions/context_session_{feature_name}.md` should contain most of context did, overall plan, and sub agents will continuosly add context to the file
- After you finish the work, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did
- After you finish the each phase, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did

### Phase 3

- After finish the final implementation MUST use qa-criteria-validator subagent to provide a report feedback an iterate over this feedback until acceptance criterias are passed
- After qa-criteria-validator finish, you MUST review their report and implement the feedback related with the feature

## Subagents

You have access to 8 subagents:

- shadcn-ui-architect: all task related to UI building & tweaking HAVE TO consult this agent
- qa-criteria-validator: all final client UI/UX implementations has to be validated by this subagent to provide feedback an iterate.
- ui-ux-analyzer: all the task related with UI review, improvements & tweaking HAVE TO consult this agent
- pydantic-ai-architect: all task related to ai agents using pydantic-ai framework, all task related to business logic in the client side before create the UI HAVE TO consult this agent
- business-logic-architect: all task related to business logic in the client side after HAVE TO consult this agent to get the necesary test cases definitions
- backend-business-logic-architect: all task related to business logic in the backend side HAVE TO consult this agent
- backend-test-architect: all task related to business logic in the backend side after HAVE TO consult this agent to get the necesary test cases definitions

When you want you can consult the subagents about the implementation and request feedback, but you will be the one who does the implementation.

When you consult a subagent, make sure you pass the context file, e.g. `.claude/sessions/context_session_{feature_name}.md`.

Before you do the work, make sure you read the related documentation they created and the plan before you start executing.