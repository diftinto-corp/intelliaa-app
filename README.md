# IntelliAA Platform

An AI-powered voice and WhatsApp assistant platform built on [Basejump](https://github.com/usebasejump/basejump) and Next.js. IntelliAA enables businesses to create, deploy, and manage intelligent conversational AI assistants with voice synthesis, document-based knowledge retrieval (RAG), and comprehensive analytics.

## Features

### Voice & WhatsApp Assistants
- **AI Voice Assistants**: Create voice-enabled AI assistants powered by Vapi with ElevenLabs voice synthesis
- **WhatsApp Bots**: Deploy conversational assistants to WhatsApp with automated responses
- **Phone Number Management**: Purchase and manage phone numbers via Twilio integration
- **Real-time Analytics**: Track calls, messages, and conversation metrics with detailed reports

### Document Intelligence
- **Knowledge Base Management**: Upload and organize documents (PDFs, text files) for AI context
- **RAG (Retrieval-Augmented Generation)**: Assistants access document knowledge via Flowise vector embeddings
- **Document Processing**: Automatic text extraction, chunking, and embedding generation
- **Multi-Assistant Sharing**: Link document stores to multiple assistants

### Multi-Tenant Architecture
- **Personal Accounts**: Individual user accounts with isolated resources
- **Team Accounts**: Collaborative workspaces with role-based permissions
- **Member Management**: Invite team members with customizable access levels
- **Billing Integration**: Stripe-powered subscription management (optional)

### Technical Capabilities
- **Customizable AI Behavior**: Adjust temperature, token limits, and system prompts
- **Template System**: Pre-configured assistant templates for common use cases
- **Voice Customization**: Choose from multiple voice options and languages
- **Transfer Rules**: Set up keyword and number-based call/message routing
- **Secure File Storage**: AWS S3 integration for document and audio files

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router, TypeScript, Turbopack)
- **Runtime**: React 19.1.1
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Supabase SSR**: v0.5.2 (async API support)
- **Authentication**: Supabase Auth
- **AI Services**:
  - Vapi (voice AI)
  - Flowise (document processing & RAG)
  - ElevenLabs (voice synthesis)
  - OpenAI (language models)
- **Infrastructure**:
  - Railway (GraphQL backend, WhatsApp deployments)
  - AWS S3 (file storage)
  - Twilio (telephony)
  - Upstash Redis (caching)
- **State Management**: Apollo Client (GraphQL), SWR
- **UI**: Radix UI, TailwindCSS, Recharts
- **Email**: Resend

> **Note**: This project uses Next.js 15 with React 19. Some dependencies require `--legacy-peer-deps` during installation. See [CLAUDE.md](./CLAUDE.md) for migration details and breaking changes.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for local Supabase)
- Supabase account
- Access to required API keys (Vapi, Flowise, Railway, etc.)

### Installation

1. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   > Note: Uses `--legacy-peer-deps` due to some packages not yet fully supporting React 19

2. **Start local Supabase**
   ```bash
   supabase start
   ```
   Note the API URL and anon key from the output.

3. **Configure environment variables**

   Create a `.env.local` file with the following variables:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Flowise (Document Processing)
   NEXT_PUBLIC_FLOWISE=https://your-flowise-instance.com/api/v1/
   NEXT_PUBLIC_FLOWISE_KEY=your_flowise_key
   NEXT_PUBLIC_FLOWISE_CHATID_PREDICTION=your_chat_id
   NEXT_PUBLIC_USERNAME_FLOWISE=your_username
   NEXT_PUBLIC_PASSWORD_FLOWISE=your_password

   # Railway (Backend)
   RAILWAY_URI=your_railway_graphql_uri
   RAILWAY_TOKEN=your_railway_token

   # AWS S3 (File Storage)
   NEXT_AWS_S3_ACCESS_KEY_ID=your_access_key
   NEXT_AWS_S3_SECRET_ACCESS_KEY=your_secret_key
   NEXT_AWS_S3_BUCKET_NAME=your_bucket_name
   NEXT_AWS_S3_REGION=us-east-1
   NEXT_AWS_S3_BUCKET_URL_FILE=https://your-bucket.s3.amazonaws.com/

   # Vapi (Voice AI)
   NEXT_PRIVATE_VAPI_KEY=your_vapi_key

   # ElevenLabs (Voice Synthesis)
   NEXT_PUBLIC_ELEVENLABS_TOKEN=your_elevenlabs_token

   # Buildship (WhatsApp Deployment)
   NEXT_PUBLIC_BUILDSHIP_URL_DEPLOY_RAILWAY=your_buildship_url

   # Event Token
   NEXT_PUBLIC_EVENT_TOKEN=your_event_token
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   > Starts with Turbopack enabled for faster compilation

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

The Supabase migrations in `supabase/migrations/` include:
- Basejump core schema (accounts, permissions, billing)
- IntelliAA custom tables (assistants, documents, reports)
- Row Level Security policies

Run migrations:
```bash
supabase db reset  # Resets and applies all migrations
```

### Billing Setup (Optional)

To enable Stripe billing:
1. Create a Stripe account
2. Add Stripe keys to `supabase/functions/.env`
3. Configure webhook endpoints
4. See [Basejump billing docs](https://usebasejump.com/docs)

## Project Structure

```
intelliaa-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── [accountSlug]/            # Multi-tenant routes
│   │   │   ├── assistants/           # AI assistant management
│   │   │   ├── documents/            # Knowledge base documents
│   │   │   ├── numbers/              # Phone number management
│   │   │   ├── reports/              # Analytics & reporting
│   │   │   └── settings/             # Account settings
│   │   ├── api/                      # API routes
│   │   └── auth/                     # Authentication flows
│   ├── components/
│   │   ├── basejump/                 # Account/team management UI
│   │   ├── intelliaa/                # IntelliAA-specific components
│   │   └── ui/                       # Reusable UI components
│   ├── lib/
│   │   ├── actions/                  # Server actions
│   │   │   ├── intelliaa/            # IntelliAA-specific actions
│   │   │   └── ...                   # Basejump actions
│   │   ├── supabase/                 # Supabase clients
│   │   └── hooks/                    # React hooks
│   ├── services/                     # External API services
│   │   ├── vapiService.ts            # Vapi voice AI
│   │   └── flowiseService.ts         # Flowise document processing
│   └── types/                        # TypeScript type definitions
├── supabase/
│   ├── migrations/                   # Database migrations
│   ├── functions/                    # Edge functions
│   └── config.toml                   # Supabase configuration
└── public/                           # Static assets
```

## Key Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack (localhost:3000)
npm run build        # Build for production
npm start            # Start production server

# Installation (when adding new packages)
npm install --legacy-peer-deps  # Required for React 19 compatibility

# Supabase
supabase start       # Start local Supabase (Docker)
supabase stop        # Stop local Supabase
supabase db reset    # Reset DB and run migrations
supabase db push     # Push local migrations to remote
supabase status      # Check running services
supabase functions serve  # Run edge functions locally

# Database
supabase migration new <name>  # Create new migration
supabase db diff               # Generate migration from schema changes
```

## Architecture Overview

### Multi-Tenant System
IntelliAA uses Basejump's account-based multi-tenancy:
- Every route under `/[accountSlug]/` is scoped to an account
- Row Level Security (RLS) enforces data isolation
- Users can belong to multiple accounts with different roles

### AI Assistant Lifecycle
1. **Create**: New assistant with template, prompt, and settings
2. **Configure**: Add documents, adjust parameters, select voice
3. **Deploy**:
   - Voice: Assign phone number via Twilio
   - WhatsApp: Deploy to Railway, scan QR code
4. **Monitor**: View analytics in reports section
5. **Delete**: Cascade deletion of documents, reports, and deployments

### Document Processing Flow
1. Upload file (PDF, TXT) → AWS S3
2. Create document store in Flowise
3. Process with loaders/splitters → text chunks
4. Generate embeddings → vector store
5. Link to assistant(s) via junction table
6. Assistant queries vectors during conversations (RAG)

### External Service Integration
- **Vapi**: Voice AI engine, file uploads
- **Flowise**: Document processing, embeddings, vector search
- **Railway**: WhatsApp deployment, GraphQL backend
- **ElevenLabs**: Voice synthesis for assistants
- **Twilio**: Phone number provisioning and telephony
- **Buildship**: WhatsApp deployment orchestration

## Development Guidelines

### Next.js 15 Patterns (Important!)

**Async Server APIs:**
```typescript
// Server Component
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;  // MUST await params
  const supabase = await createClient();  // MUST await Supabase client
}

// Server Action
export async function myAction() {
  const supabase = await createClient();  // MUST await
}
```

**Hydration Safety:**
- Theme-dependent content must check `mounted` state
- Empty `src` attributes cause warnings: use `{url && <img src={url} />}`

### Supabase Client Usage
- **Server Components**: Use `await createClient()` from `@/lib/supabase/server` (async!)
- **Client Components**: Use `createClient()` from `@/lib/supabase/client`
- **API Routes**: Use `await createClient()` from server client
- **Middleware**: Uses `@/lib/supabase/middleware`

### Path Aliases
Always use `@/*` imports:
```typescript
import { createClient } from "@/lib/supabase/client"
import { GetAllAssistants } from "@/lib/actions/intelliaa/assistants"
```

### Environment Variables
- `NEXT_PUBLIC_*` → Client-side accessible
- Others → Server-side only
- Never commit `.env.local`

### Database Conventions
- All custom tables use RLS policies
- Namespace pattern: Random 13-char string for assistant isolation
- Junction tables: `table1-table2` (e.g., `document_storage-assistants`)
- Soft deletes recommended for audit trails

## Helpful Links

- [Basejump Documentation](https://usebasejump.com/docs)
- [Next.js 15 Docs](https://nextjs.org/docs) - Updated for Next.js 15
- [React 19 Docs](https://react.dev/blog/2024/12/05/react-19) - React 19 release notes
- [Supabase Documentation](https://supabase.com/docs)
- [Vapi Documentation](https://docs.vapi.ai/)
- [Flowise Documentation](https://docs.flowiseai.com/)

## Support

For development assistance, see the [CLAUDE.md](./.claude/CLAUDE.md) file which provides detailed architecture guidance, Next.js 15 migration notes, and important breaking changes.