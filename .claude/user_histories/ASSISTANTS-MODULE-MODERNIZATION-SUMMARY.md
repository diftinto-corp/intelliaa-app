# Assistants Module Modernization - User Stories Summary

## Overview

This document provides a comprehensive summary of all user stories created for the IntelliAA Assistants Module Modernization project. All stories have been created in Linear and are tracked under the "IntelliAA - Plataforma de Asistentes de IA Multi-Canal" project.

**Project Context:** Modernize the assistants module to integrate new technologies (Evolution API, Vercel AI SDK, latest VAPI) and improve UX while maintaining multi-tenant compatibility.

**Total Epics:** 5
**Total User Stories:** 18
**Estimated Timeline:** Q1-Q2 2025

---

## Epic 1: Master-Detail UI and Navigation (INT-29)

**Objective:** Modernize the assistants page with a master-detail layout optimized for managing multiple AI assistants.

**Priority:** High | **Status:** Backlog

### User Stories

#### INT-30: Implement Master-Detail Layout for Assistants List
- **Priority:** P0 (Must Have) | **Complexity:** L (5-8 points)
- **URL:** https://linear.app/intelliaa/issue/INT-30
- **Summary:** Create responsive master-detail layout with assistant list on left and configuration details on right
- **Key Features:** Responsive design, empty states, skeleton loaders, URL state management
- **Dependencies:** None (foundational)

#### INT-31: Add Advanced Filtering and Search to Assistants List
- **Priority:** P0 (Must Have) | **Complexity:** M (3-5 points)
- **URL:** https://linear.app/intelliaa/issue/INT-31
- **Summary:** Enable filtering by name, type, status with real-time search and URL persistence
- **Key Features:** Debounced search, combined filters, result count, no results state
- **Dependencies:** INT-30

#### INT-32: Implement Real-Time Status Visualization for Assistants
- **Priority:** P0 (Must Have) | **Complexity:** M (3-5 points)
- **URL:** https://linear.app/intelliaa/issue/INT-32
- **Summary:** Real-time status badges (active, configuring, error, disconnected) with Supabase Realtime
- **Key Features:** Color-coded badges, error tooltips, status history, summary statistics
- **Dependencies:** INT-30

#### INT-33: Create Onboarding Experience for First-Time Users
- **Priority:** P1 (Should Have) | **Complexity:** S (1-2 points)
- **URL:** https://linear.app/intelliaa/issue/INT-33
- **Summary:** Engaging empty state with value proposition, CTAs, and video tutorial
- **Key Features:** Empty state illustration, assistant type preview, quick start guide
- **Dependencies:** INT-30

**Epic Success Metrics:**
- Average time to find assistant: < 5 seconds
- User satisfaction score: > 8/10
- Mobile usability score: > 85%

---

## Epic 2: Step-by-Step Assistant Creation Wizard (INT-34)

**Objective:** Replace basic modal creation with comprehensive wizard using industry-specific templates.

**Priority:** High | **Status:** Backlog

### User Stories

#### INT-35: Build Multi-Step Wizard UI with Progress Indicator
- **Priority:** P0 (Must Have) | **Complexity:** M (3-5 points)
- **URL:** https://linear.app/intelliaa/issue/INT-35
- **Summary:** Multi-step wizard with progress indicator, validation, and state management
- **Key Features:** Step navigation, validation blocking, exit confirmation, mobile responsive
- **Dependencies:** None (foundational)

#### INT-36: Create Industry-Specific Template Library and Selection Step
- **Priority:** P0 (Must Have) | **Complexity:** L (5-8 points)
- **URL:** https://linear.app/intelliaa/issue/INT-36
- **Summary:** Template library with 15+ industry-specific templates organized by category
- **Key Features:** Template preview, search/filter, metadata display, blank template option
- **Dependencies:** INT-35, assistants_template table

#### INT-37: Implement Assistant Type Selection Step
- **Priority:** P0 (Must Have) | **Complexity:** S (1-2 points)
- **URL:** https://linear.app/intelliaa/issue/INT-37
- **Summary:** First wizard step for selecting Voice, WhatsApp, or Web assistant type
- **Key Features:** Type cards with features, selection interaction, type-specific filtering
- **Dependencies:** INT-35

#### INT-38: Build Configuration Step with Real-Time Validation
- **Priority:** P0 (Must Have) | **Complexity:** L (5-8 points)
- **URL:** https://linear.app/intelliaa/issue/INT-38
- **Summary:** Configuration step with pre-filled template values and real-time validation
- **Key Features:** Name uniqueness check, prompt variables, temperature/token sliders, document storage
- **Dependencies:** INT-35, INT-36

**Epic Success Metrics:**
- Average creation time: < 5 minutes
- Creation completion rate: > 90%
- Template usage rate: > 75%

---

## Epic 3: Voice Assistant VAPI Integration Modernization (INT-39)

**Objective:** Migrate to latest VAPI API and add advanced voice features.

**Priority:** High | **Status:** Backlog

### User Stories

#### INT-40: Migrate VAPI Configuration to Latest API Version
- **Priority:** P0 (Must Have) | **Complexity:** XL (8-13 points)
- **URL:** https://linear.app/intelliaa/issue/INT-40
- **Summary:** Automated migration of all voice assistants to latest VAPI API
- **Key Features:** API version detection, migration script, backward compatibility, rollback capability
- **Dependencies:** VAPI API documentation, voice_assistant table

#### INT-41: Update ElevenLabs Voice Catalog with Enhanced Previews
- **Priority:** P1 (Should Have) | **Complexity:** M (3-5 points)
- **URL:** https://linear.app/intelliaa/issue/INT-41
- **Summary:** Browse ElevenLabs voices with audio previews, metadata, and custom text
- **Key Features:** Voice catalog display, audio preview, voice comparison, favorites
- **Dependencies:** INT-39, ElevenLabs API

#### INT-42: Implement Intelligent Call Transfer Rules Engine
- **Priority:** P1 (Should Have) | **Complexity:** L (5-8 points)
- **URL:** https://linear.app/intelliaa/issue/INT-42
- **Summary:** Configure transfer rules based on keywords, intent, sentiment, and business hours
- **Key Features:** Keyword/intent/sentiment-based transfer, number mapping, analytics
- **Dependencies:** INT-39, existing transfer fields

**Epic Success Metrics:**
- VAPI API migration: 100% of assistants
- Voice quality improvement: +25%
- Transfer accuracy: > 95%
- Configuration time reduction: -40%

---

## Epic 4: WhatsApp Evolution API Migration (INT-43)

**Objective:** Replace Railway/Buildship with Evolution API and Vercel AI SDK.

**Priority:** High | **Status:** Backlog

### User Stories

#### INT-44: Integrate Evolution API for WhatsApp Instance Management
- **Priority:** P0 (Must Have) | **Complexity:** XL (8-13 points)
- **URL:** https://linear.app/intelliaa/issue/INT-44
- **Summary:** Evolution API integration for instance creation, QR codes, and status monitoring
- **Key Features:** Instance CRUD, QR generation, real-time status, multi-tenant isolation
- **Dependencies:** Evolution API deployment, assistants table schema

#### INT-45: Implement Vercel AI SDK for WhatsApp Conversations with RAG
- **Priority:** P0 (Must Have) | **Complexity:** XL (8-13 points)
- **URL:** https://linear.app/intelliaa/issue/INT-45
- **Summary:** Vercel AI SDK for conversations with RAG using Pinecone/Upstash
- **Key Features:** AI SDK integration, RAG queries, streaming responses, conversation memory
- **Dependencies:** INT-44, document storage, Pinecone/Upstash

#### INT-46: Create Migration Tool from Railway/Buildship to Evolution API
- **Priority:** P1 (Should Have) | **Complexity:** L (5-8 points)
- **URL:** https://linear.app/intelliaa/issue/INT-46
- **Summary:** Automated migration tool with rollback and verification
- **Key Features:** Migration script, config preservation, rollback, migration dashboard
- **Dependencies:** INT-44, INT-45

**Epic Success Metrics:**
- Deployment time: < 30 seconds (vs 2-3 minutes)
- Infrastructure cost reduction: -70%
- Message delivery reliability: > 99.5%
- Migration completion: 100%

---

## Epic 5: Web Assistant Development (INT-47) - FUTURE PHASE

**Objective:** Build web chat assistants with embeddable widgets (Lower Priority).

**Priority:** Medium | **Status:** Backlog (Future Phase)

### Notes

This epic is deferred to a future phase. Focus should be on Voice and WhatsApp modernization first. Web assistants will leverage the RAG and Vercel AI SDK infrastructure already built for WhatsApp.

**Epic Success Metrics:**
- Widget load time: < 1 second
- First response time: < 2 seconds
- Conversation completion rate: > 70%

---

## Implementation Priorities

### Phase 1: Foundation (Must Have - Q1 2025)
1. **INT-30:** Master-Detail Layout (foundational UI)
2. **INT-35:** Wizard UI Framework
3. **INT-37:** Type Selection Step

### Phase 2: Core Features (Must Have - Q1 2025)
4. **INT-31:** Filtering and Search
5. **INT-32:** Status Visualization
6. **INT-36:** Template Library
7. **INT-38:** Configuration Step with Validation

### Phase 3: Voice Modernization (Must Have - Q1-Q2 2025)
8. **INT-40:** VAPI API Migration (critical path)
9. **INT-41:** ElevenLabs Voice Catalog
10. **INT-42:** Transfer Rules Engine

### Phase 4: WhatsApp Migration (Must Have - Q2 2025)
11. **INT-44:** Evolution API Integration (critical path)
12. **INT-45:** Vercel AI SDK + RAG (critical path)
13. **INT-46:** Migration Tool

### Phase 5: Enhancements (Should Have - Q2 2025)
14. **INT-33:** Onboarding Experience

### Phase 6: Future (Could Have - Q3+ 2025)
15. **INT-47:** Web Assistants (deferred)

---

## Technical Architecture Summary

### Multi-Tenancy
- All features respect account-based RLS policies
- Namespace-based document isolation maintained
- Permission validation at all operation levels

### External Integrations
- **VAPI:** Voice AI (latest API version)
- **Evolution API:** WhatsApp instance management (new)
- **Vercel AI SDK:** Conversations + RAG (new for WhatsApp)
- **ElevenLabs:** Voice synthesis catalog
- **Pinecone/Upstash:** Vector storage for RAG
- **Twilio:** Phone number provisioning

### Database Changes Required
- Add: `evolution_instance_id`, `evolution_status`, `qr_code_url` to assistants table
- Add: `status`, `migration_status` enum fields
- Remove: `service_id_rw`, `is_deploying_ws` (deprecated Railway fields)
- New tables: `transfer_rules`, `migration_log`, `whatsapp_conversation_history`

### API Routes to Update/Create
- `/api/assistants/create` (wizard integration)
- `/api/assistants/[id]/evolution` (Evolution API management)
- `/api/webhooks/evolution-api` (new)
- `/api/assistants/[id]/voice/transfer-rules` (new)
- Update: `/api/create-assistant-voice`, `/api/update-assistant-voice`

---

## Risk Mitigation

### High-Risk Items
1. **VAPI Migration (INT-40):** Extensive testing required, implement feature flags
2. **Evolution API Integration (INT-44):** Ensure stable hosting, monitoring, fallback
3. **WhatsApp Migration (INT-46):** Zero-downtime requirement, thorough rollback testing

### Mitigation Strategies
- Feature flags for gradual rollout
- Comprehensive migration testing with 100+ assistants
- Rollback mechanisms for all migrations
- Extensive monitoring and alerting
- User communication plan for QR code re-scanning

---

## Success Criteria

### User Experience
- Assistant creation time: < 5 minutes (from 15+)
- Configuration error rate: < 1%
- User satisfaction: > 8/10 across all features

### Technical Performance
- Page load time: < 1 second
- Real-time updates: < 500ms latency
- API response times: < 500ms
- Voice quality improvement: +25%
- WhatsApp deployment: < 30 seconds

### Business Impact
- Infrastructure cost reduction: -70% (WhatsApp)
- Support ticket reduction: -50%
- Feature adoption rate: > 75%
- Migration success rate: 100%

---

## Documentation Links

- **Linear Project:** https://linear.app/intelliaa/project/intelliaa-plataforma-de-asistentes-de-ia-multi-canal-5e91c1377a03
- **Session Context:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/sessions/context_session_assistants-module-modernization.md`
- **CLAUDE.md:** `/Volumes/raul-1TB/Proyectos/intelliaa-app/.claude/CLAUDE.md`

---

**Created:** 2025-10-06
**Linear Team:** Intelliaa
**Total Story Points:** ~90-130 points (approximately 3-4 months with 2-3 developers)
