# Session Context: Assistants Module Modernization

## Feature Overview
Modernization of the IntelliAA Assistants Management Module to integrate new technologies and improve UX while maintaining multi-tenant compatibility.

## Initial Analysis

### Current State Assessment
Based on codebase review:

**Existing Assistant Types:**
1. Voice Assistants (VAPI integration)
2. WhatsApp Assistants (Railway/Buildship integration)

**Current Architecture:**
- Multi-tenant structure using Basejump account-based isolation
- Namespace-based document isolation
- External integrations: VAPI, ElevenLabs, Flowise, Railway, Twilio
- Data models: `assistants`, `assistants_template`, `voice_assistant`, `document_storage-assistants`

**Key Files:**
- Actions: `/src/lib/actions/intelliaa/assistants.ts`
- Main Page: `/src/app/[accountSlug]/assistants/page.tsx`
- Components: `/src/components/intelliaa/assistants/*`

### Proposed Changes Summary

**Technology Modernization:**
1. Voice Assistants: Migrate deprecated VAPI configurations to current API
2. WhatsApp Assistants: Replace Railway/Buildship with Evolution API + Vercel AI SDK
3. Web Assistants: New development from scratch using Vercel AI SDK

**UX Improvements:**
1. Master-detail layout for assistant management
2. Step-by-step creation wizard with templates
3. Advanced filtering and search
4. Onboarding page for new users
5. Integrated testing capabilities

**Feature Enhancements:**
1. Enhanced configuration tabs per assistant type
2. Real-time status visualization
3. Improved document storage integration
4. Analytics and monitoring dashboards

### Multi-tenancy Considerations
- All features must respect account-based isolation via RLS policies
- Namespace pattern for document isolation must be maintained
- Permission validation required at all operation levels
- Quota and limit enforcement per account

### External Integration Points

**VAPI (Voice):**
- Rate limit handling
- Error recovery mechanisms
- Configuration migration path

**Evolution API (WhatsApp - NEW):**
- Instance management
- Webhook configuration
- QR code generation
- Session persistence

**Vercel AI SDK (NEW):**
- Streaming responses
- RAG implementation
- Document processing
- Error handling

**ElevenLabs:**
- Voice catalog updates
- Audio preview optimization
- Request caching

### Technical Constraints
- Next.js 15.5.4 with async APIs
- React 19.1.1 requirements
- Supabase RLS policy enforcement
- Type-safe environment variables (src/lib/env.ts)

### Dependencies Identified
- Document storage module must support new assistant types
- API routes need updates for new integrations
- Authentication/authorization preserved from Basejump
- Billing integration for usage tracking

## Next Steps
1. Consult with specialized subagents for detailed planning
2. Break down features into user stories
3. Define acceptance criteria
4. Prioritize implementation order
5. Create Linear issues for tracking

## User Stories Created

### Summary
- **Total Epics Created:** 5
- **Total User Stories:** 18
- **Total Estimated Story Points:** 90-130 points
- **Linear Project:** IntelliAA - Plataforma de Asistentes de IA Multi-Canal

### Epic Breakdown

#### Epic 1: Master-Detail UI and Navigation (INT-29)
- INT-30: Master-Detail Layout (L - 5-8 points) - P0
- INT-31: Advanced Filtering and Search (M - 3-5 points) - P0
- INT-32: Real-Time Status Visualization (M - 3-5 points) - P0
- INT-33: Onboarding Experience (S - 1-2 points) - P1

#### Epic 2: Assistant Creation Wizard (INT-34)
- INT-35: Multi-Step Wizard UI (M - 3-5 points) - P0
- INT-36: Template Library (L - 5-8 points) - P0
- INT-37: Type Selection Step (S - 1-2 points) - P0
- INT-38: Configuration Step (L - 5-8 points) - P0

#### Epic 3: Voice Assistant VAPI Modernization (INT-39)
- INT-40: VAPI API Migration (XL - 8-13 points) - P0
- INT-41: ElevenLabs Voice Catalog (M - 3-5 points) - P1
- INT-42: Transfer Rules Engine (L - 5-8 points) - P1

#### Epic 4: WhatsApp Evolution API Migration (INT-43)
- INT-44: Evolution API Integration (XL - 8-13 points) - P0
- INT-45: Vercel AI SDK + RAG (XL - 8-13 points) - P0
- INT-46: Migration Tool (L - 5-8 points) - P1

#### Epic 5: Web Assistants (INT-47) - FUTURE PHASE
- Deferred to Q3+ 2025 (lower priority)

### Implementation Phases

**Phase 1 - Foundation (Q1 2025):**
- Master-Detail Layout, Wizard Framework, Type Selection
- Focus: Essential UI infrastructure

**Phase 2 - Core Features (Q1 2025):**
- Filtering/Search, Status Visualization, Templates, Configuration
- Focus: Complete creation and management workflows

**Phase 3 - Voice Modernization (Q1-Q2 2025):**
- VAPI Migration, Voice Catalog, Transfer Rules
- Focus: Voice assistant enhancement

**Phase 4 - WhatsApp Migration (Q2 2025):**
- Evolution API, Vercel AI SDK, Migration Tool
- Focus: WhatsApp infrastructure modernization

**Phase 5 - Enhancements (Q2 2025):**
- Onboarding, Polish, Performance optimization
- Focus: User experience refinement

### Key Technical Decisions

**Architecture:**
- Vercel AI SDK for all AI conversations (WhatsApp, Web future)
- Evolution API for WhatsApp instance management
- Pinecone/Upstash for vector storage (RAG)
- Latest VAPI API for voice assistants
- Supabase Realtime for status updates

**Database Schema Changes:**
- Add: `evolution_instance_id`, `evolution_status`, `qr_code_url`, `status`, `migration_status`
- Remove: `service_id_rw`, `is_deploying_ws` (deprecated)
- New tables: `transfer_rules`, `migration_log`, `whatsapp_conversation_history`

**Migration Strategy:**
- Feature flags for gradual rollout
- Automated migration scripts with rollback
- Zero-downtime deployments
- Comprehensive testing with 100+ assistants

### Success Metrics Defined

**User Experience:**
- Creation time: < 5 minutes (from 15+)
- User satisfaction: > 8/10
- Error rate: < 1%

**Technical Performance:**
- Page load: < 1 second
- Real-time updates: < 500ms
- API responses: < 500ms
- WhatsApp deployment: < 30 seconds

**Business Impact:**
- Infrastructure cost: -70% (WhatsApp)
- Support tickets: -50%
- Migration success: 100%

### Documentation Created

1. **Linear Issues:** All 18 user stories with detailed acceptance criteria
2. **Summary Document:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/user_histories/ASSISTANTS-MODULE-MODERNIZATION-SUMMARY.md`
3. **This Context File:** Complete session documentation

### Risk Assessment

**High-Risk Items:**
1. VAPI Migration (INT-40) - Backward compatibility critical
2. Evolution API Integration (INT-44) - New infrastructure dependency
3. WhatsApp Migration (INT-46) - Zero-downtime requirement

**Mitigation:**
- Extensive testing environments
- Feature flags for controlled rollout
- Rollback mechanisms for all migrations
- User communication plans
- Monitoring and alerting infrastructure

---
**Session Created:** 2025-10-06
**Session Completed:** 2025-10-06
**Status:** User Stories Created and Documented
**Linear Team:** Intelliaa
**Next Actions:** Begin Phase 1 implementation with INT-30 (Master-Detail Layout)
