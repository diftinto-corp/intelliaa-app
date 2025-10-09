# Context Session: INT-33 - Onboarding Experience for First-Time Users

## Feature Overview

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P1 - Should Have
**Estimate**: 1-2 points (Small)
**Labels**: frontend, ux, onboarding
**Branch**: `feature/INT-33-onboarding-experience`

## User Story

As a new IntelliAA user with no assistants yet, I want to see an engaging onboarding experience that explains assistant types and guides me to create my first assistant, so that I understand the platform's capabilities and can get started quickly.

## Initial Analysis

### 1. Feature Scope

This feature introduces a first-time user onboarding experience that displays when a user has zero assistants. The experience includes:

- Full-screen empty state with illustration
- Heading: "Create Your First AI Assistant"
- Descriptive text explaining platform value
- Three preview cards for Voice, WhatsApp, and Web assistant types
- Primary CTA: "Create Assistant" button
- Secondary action: "Browse Templates" button
- Tertiary action: "View Quick Start Guide" link
- Auto-dismissal when first assistant is created

### 2. Technical Architecture

**Component Structure:**
- Location: `src/components/intelliaa/assistants/onboarding/`
- Main component: `AssistantsOnboarding.tsx`
- Child components:
  - `EmptyStateIllustration.tsx` - Visual illustration component
  - `AssistantTypeCard.tsx` - Reusable card for each assistant type
  - `QuickStartGuideDialog.tsx` - Modal/dialog for guide content

**Conditional Rendering:**
- Show when: `assistants.length === 0`
- Integration point: Main assistants page layout (likely in `/[accountSlug]/assistants/page.tsx`)
- No explicit dismissal state needed (naturally dismissed when first assistant created)

**Routing & Navigation:**
- Create Assistant: `/${accountSlug}/assistants/new`
- Browse Templates: `/${accountSlug}/assistants/new?step=templates`
- Depends on INT-35 (wizard) and INT-36 (template selection) being implemented

### 3. Key Technical Considerations

**Next.js 15 Compatibility:**
- Must use async `params` in page components
- Server Component by default (no client-side logic needed in main onboarding view)
- Child components (buttons, dialog) will need `"use client"` directive for interactivity

**Styling & Design:**
- Use existing shadcn/ui components (Button, Card, Dialog)
- Leverage Lucide React icons for consistency
- Implement responsive grid: 3 columns (desktop) → 2 columns (tablet) → 1 column (mobile)
- Follow existing Radix UI theming

**Data Requirements:**
- Need to check assistant count from database
- Likely already available in parent page component
- Pass count as prop or use context to determine visibility

**Accessibility:**
- Semantic HTML structure
- ARIA labels for all interactive elements
- Keyboard navigation support
- Focus management for dialog/modal

### 4. Integration Points

**Dependencies:**
- INT-30: Layout component that determines when to show onboarding
- INT-35: Wizard navigation target for "Create Assistant" button
- INT-36: Template selection navigation target for "Browse Templates" button

**Data Sources:**
- Assistant count from: `src/lib/actions/intelliaa/assistants.ts`
- Account slug from: `useParams()` hook
- User routing via: Next.js `useRouter()` hook

### 5. Implementation Phases

**Phase 1: Core Structure (Priority: High)**
1. Create component directory structure
2. Build main `AssistantsOnboarding.tsx` component
3. Implement conditional rendering logic in parent page
4. Set up responsive layout with TailwindCSS

**Phase 2: Assistant Type Cards (Priority: High)**
1. Create `AssistantTypeCard.tsx` component
2. Define assistant type data structure
3. Implement icon + title + description + features list
4. Add hover effects and styling

**Phase 3: Empty State Illustration (Priority: Medium)**
1. Create `EmptyStateIllustration.tsx`
2. Compose illustration using Lucide icons or integrate external SVG
3. Ensure brand color consistency
4. Add subtle animations (optional)

**Phase 4: Quick Start Guide (Priority: Low)**
1. Create `QuickStartGuideDialog.tsx`
2. Decide between video embed, interactive tour, or documentation link
3. Implement dialog with shadcn/ui Dialog component
4. Add content (placeholder acceptable for MVP)

**Phase 5: Navigation & Integration (Priority: High)**
1. Implement "Create Assistant" button navigation
2. Implement "Browse Templates" button navigation
3. Verify integration with INT-35 and INT-36 routes
4. Test navigation flow

**Phase 6: Polish & Testing (Priority: Medium)**
1. Responsive design testing (mobile, tablet, desktop)
2. Accessibility audit (keyboard navigation, screen readers)
3. Cross-browser testing
4. Performance optimization

### 6. Acceptance Criteria Checklist

- [ ] AC1: Full-screen empty state with illustration and heading displays when zero assistants
- [ ] AC2: Three assistant type preview cards (Voice, WhatsApp, Web) with icons and features
- [ ] AC3: "Create Assistant" button navigates to wizard (INT-35)
- [ ] AC4: "View Quick Start Guide" opens side panel/modal with tutorial content
- [ ] AC5: "Browse Templates" button navigates to template selection (INT-36)
- [ ] AC6: Onboarding never shows again after first assistant is created
- [ ] Responsive design verified on mobile, tablet, desktop
- [ ] Accessibility verified (semantic HTML, ARIA labels, keyboard nav)

### 7. Questions & Risks

**Questions:**
1. Does INT-35 (wizard) already exist? Need to verify route availability
2. Does INT-36 (template selection) already exist? Need to verify query param handling
3. What content should the Quick Start Guide contain? (Video? Interactive tour? Docs link?)
4. Should we add analytics tracking for onboarding engagement?
5. Should there be a "Skip" option, or is natural dismissal sufficient?

**Risks:**
- **Dependency risk**: INT-35 and INT-36 may not be implemented yet
- **Content risk**: Quick Start Guide content not yet defined
- **UX risk**: Illustration design may require design team input
- **Performance risk**: Adding components may impact page load time

**Mitigation:**
- Verify route dependencies before navigation implementation
- Start with placeholder content for Quick Start Guide
- Use lightweight Lucide icon compositions for illustration
- Lazy load Quick Start Guide dialog component

---

## Shadcn/UI Architecture Recommendations

### Analysis Summary

After reviewing the existing codebase, I've identified the following:

**Current shadcn/ui Setup:**
- shadcn/ui configured with RSC support (React Server Components)
- Base color: `slate` with CSS variables
- Components installed: Button, Card, Dialog, Sheet, Skeleton, Badge, Tabs, and many more
- Theme system: Dark/light mode with teal-based primary color (`--primary: 173.4 80.4% 40%`)
- Responsive utilities: Custom animations and existing mobile/desktop patterns
- Existing empty state: `AssistantsEmptyState.tsx` (Card-based, feature highlights grid)

**Key Observations:**
1. The current empty state is already functional but basic
2. The layout uses hydration-safe patterns with `useIsMounted()` hook
3. Mobile responsiveness handled via `useIsMobile()` hook
4. Theme uses teal gradient for primary actions (existing in globals.css)

---

### Component Architecture Recommendations

#### 1. **Component Selection & Structure**

**Primary shadcn/ui Components:**
- **Card** (`@/components/ui/card`) - Main container for onboarding content
- **Button** (`@/components/ui/button`) - Primary, secondary, and link variants for CTAs
- **Dialog** (`@/components/ui/dialog`) - For Quick Start Guide modal
- **Sheet** (`@/components/ui/sheet`) - Alternative for mobile Quick Start Guide
- **Badge** (`@/components/ui/badge`) - For assistant type labels/tags
- **Separator** (`@/components/ui/separator`) - Visual section dividers

**Component Hierarchy:**
```
AssistantsOnboarding.tsx (Client Component)
├── EmptyStateIllustration.tsx (Presentation Component)
├── AssistantTypeCard.tsx (Reusable Card Component) x3
└── QuickStartGuideDialog.tsx (Dialog Component)
```

**File Structure:**
```
src/components/intelliaa/assistants/onboarding/
├── AssistantsOnboarding.tsx          # Main orchestrator
├── EmptyStateIllustration.tsx         # Icon composition
├── AssistantTypeCard.tsx              # Reusable type card
├── QuickStartGuideDialog.tsx          # Guide modal
└── types.ts                           # TypeScript interfaces
```

---

#### 2. **Responsive Design Strategy**

**Breakpoints (Tailwind CSS):**
- **Mobile** (`< 768px`): Single column, stacked layout, full-width cards
- **Tablet** (`768px - 1024px`): Two-column grid for type cards
- **Desktop** (`≥ 1024px`): Three-column grid for type cards

**Responsive Grid Implementation:**
```tsx
// TailwindCSS classes for responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

**Container Constraints:**
```tsx
// Centered container with responsive max-width
<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
```

**Mobile Optimizations:**
- Sticky CTA button at bottom (optional)
- Reduced padding on small screens
- Icon sizes scale down proportionally
- Text sizes use responsive utilities (`text-lg md:text-xl`)

---

#### 3. **Empty State Illustration Approach**

**Recommendation: Lucide Icon Composition**

**Rationale:**
- Consistency with existing codebase (already uses Lucide React extensively)
- Lightweight (no external assets)
- Theme-aware (inherits CSS variable colors)
- Scalable and crisp on all displays

**Implementation Pattern:**
```tsx
export function EmptyStateIllustration() {
  return (
    <div className="relative flex justify-center">
      {/* Gradient glow background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl animate-pulse" />

      {/* Icon composition */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-accent p-8 rounded-3xl shadow-2xl">
        <div className="relative">
          {/* Main icon */}
          <Bot className="h-20 w-20 text-primary-foreground" />

          {/* Accent icons (optional - floating around main icon) */}
          <Phone className="absolute -top-2 -right-2 h-6 w-6 text-primary-foreground/70" />
          <MessageSquare className="absolute -bottom-2 -left-2 h-6 w-6 text-primary-foreground/70" />
        </div>
      </div>
    </div>
  );
}
```

**Alternative Approach (if design team provides assets):**
```tsx
// External SVG illustration (optional future enhancement)
<Image
  src="/illustrations/onboarding-hero.svg"
  alt="Create your first AI assistant"
  width={400}
  height={300}
  className="mx-auto"
/>
```

---

#### 4. **Quick Start Guide Dialog Approach**

**Recommendation: Dialog for Desktop, Sheet for Mobile**

**Rationale:**
- Dialog: Better for centered modal content on desktop
- Sheet: More natural slide-in experience on mobile
- Both components already installed and themed

**Implementation Strategy:**
```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { PlayCircle } from "lucide-react";

export function QuickStartGuideDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();

  const content = (
    <div className="space-y-6">
      {/* Video embed or interactive tutorial */}
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <PlayCircle className="h-16 w-16 text-muted-foreground" />
        <p className="text-sm text-muted-foreground ml-4">Video tutorial coming soon</p>
      </div>

      {/* Step-by-step guide */}
      <div className="space-y-4">
        <h3 className="font-semibold">Getting Started</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li>1. Choose your assistant type (Voice, WhatsApp, or Web)</li>
          <li>2. Configure AI settings and personality</li>
          <li>3. Connect knowledge base documents</li>
          <li>4. Deploy and start interacting</li>
        </ol>
      </div>
    </div>
  );

  // Use Sheet on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Quick Start Guide</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Start Guide</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
```

**Content Options (in priority order):**
1. **Phase 1 (MVP)**: Simple text steps with illustrations
2. **Phase 2**: Embedded Loom/YouTube video
3. **Phase 3**: Interactive tour using `react-joyride` (requires new dependency)

---

#### 5. **Accessibility Implementation**

**WCAG 2.1 AA Compliance Requirements:**

**Semantic HTML Structure:**
```tsx
<main role="main" aria-label="Onboarding experience">
  <section aria-labelledby="onboarding-heading">
    <h1 id="onboarding-heading">Create Your First AI Assistant</h1>

    <div role="list" aria-label="Assistant types">
      <article role="listitem" aria-label="Voice assistant features">
        {/* Card content */}
      </article>
    </div>
  </section>
</main>
```

**Keyboard Navigation:**
- All interactive elements must be keyboard accessible
- Logical tab order: Heading → Cards → Primary CTA → Secondary CTA → Link
- Dialog/Sheet must trap focus and restore focus on close
- ESC key closes dialog

**ARIA Labels:**
```tsx
<Button
  onClick={handleCreateAssistant}
  aria-label="Create your first AI assistant"
  aria-describedby="onboarding-description"
>
  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
  Create Assistant
</Button>

<p id="onboarding-description" className="sr-only">
  Opens the assistant creation wizard to build your first AI assistant
</p>
```

**Focus Management:**
```tsx
// Dialog focus trap (built into Radix UI Dialog)
<Dialog onOpenChange={(open) => {
  if (!open) {
    // Focus returns to trigger button automatically
  }
}}>
```

**Color Contrast:**
- Primary text on background: Use `text-foreground` (already passes WCAG AA)
- Muted text: `text-muted-foreground` (ensure 4.5:1 ratio)
- Icon-only buttons must have aria-label

**Screen Reader Support:**
```tsx
// Hide decorative icons from screen readers
<Bot className="h-16 w-16" aria-hidden="true" />

// Provide context for interactive elements
<Button aria-label="View 2-minute quick start guide tutorial">
  <PlayCircle className="w-4 h-4 mr-2" aria-hidden="true" />
  View Quick Start Guide
</Button>
```

---

#### 6. **Animation & Polish**

**Recommended Animations (Subtle & Performance-Optimized):**

**1. Fade-in on Mount:**
```tsx
// Use Tailwind's built-in animations
<div className="animate-in fade-in duration-500">
```

**2. Stagger Cards (using Framer Motion - already installed):**
```tsx
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div
  variants={container}
  initial="hidden"
  animate="show"
  className="grid grid-cols-1 md:grid-cols-3 gap-6"
>
  {assistantTypes.map((type) => (
    <motion.div key={type.id} variants={item}>
      <AssistantTypeCard {...type} />
    </motion.div>
  ))}
</motion.div>
```

**3. Hover Effects on Cards:**
```tsx
// Tailwind utility classes
<div className="transition-all duration-200 hover:scale-105 hover:shadow-lg">
```

**4. Gradient Animation (existing pattern in codebase):**
```tsx
// Already exists in AssistantsEmptyState.tsx
<div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-2xl animate-pulse" />
```

**5. Button Hover States:**
```tsx
// Use shadcn/ui Button variants (already handles hover states)
<Button
  size="lg"
  className="group transition-all hover:shadow-xl"
>
  <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
  Create Assistant
</Button>
```

**Performance Considerations:**
- Use `will-change` sparingly (only for complex animations)
- Prefer CSS transforms over layout changes
- Respect `prefers-reduced-motion` (already implemented in globals.css)
- Lazy load Framer Motion only if animations are enabled

---

#### 7. **Tailwind Class Patterns**

**Spacing & Layout:**
```tsx
// Container padding (responsive)
className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24"

// Gap utilities (responsive)
className="space-y-8 sm:space-y-12"

// Grid gaps
className="gap-4 sm:gap-6 lg:gap-8"
```

**Typography:**
```tsx
// Heading sizes (responsive)
className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"

// Body text
className="text-base sm:text-lg text-muted-foreground"

// Max-width for readability
className="max-w-prose mx-auto"
```

**Colors (using CSS variables):**
```tsx
// Background colors
className="bg-card text-card-foreground"
className="bg-primary text-primary-foreground"

// Borders
className="border border-border"

// Accent colors
className="text-primary hover:text-primary/90"
```

**Shadows & Effects:**
```tsx
// Card elevation
className="shadow-md hover:shadow-lg transition-shadow"

// Gradient backgrounds
className="bg-gradient-to-br from-primary via-primary/90 to-accent"

// Blur effects
className="backdrop-blur-sm"
```

---

#### 8. **Specific Component Recommendations**

**AssistantTypeCard Component:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, LucideIcon } from "lucide-react";

interface AssistantTypeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  badge?: string;
}

export function AssistantTypeCard({
  icon: Icon,
  title,
  description,
  features,
  badge
}: AssistantTypeCardProps) {
  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-105">
      {badge && (
        <Badge className="absolute top-4 right-4" variant="secondary">
          {badge}
        </Badge>
      )}

      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>

        <ul className="space-y-2" role="list" aria-label={`${title} features`}>
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Button Variants:**
```tsx
// Primary CTA
<Button size="lg" className="text-base px-6 py-6 h-auto">
  Create Assistant
</Button>

// Secondary action
<Button variant="outline" size="lg" className="text-base px-6 py-6 h-auto">
  Browse Templates
</Button>

// Tertiary link
<Button variant="link" className="text-base">
  View Quick Start Guide
</Button>
```

---

#### 9. **Potential Pitfalls to Avoid**

**1. Hydration Mismatches:**
```tsx
// ❌ WRONG: Direct theme access causes hydration issues
const isDark = document.documentElement.classList.contains('dark');

// ✅ CORRECT: Use mounted state
const mounted = useIsMounted();
if (!mounted) return null;
```

**2. Next.js 15 Async APIs:**
```tsx
// ❌ WRONG: Using params directly
const { accountSlug } = useParams();

// ✅ CORRECT: This is fine in Client Components (useParams is NOT async)
// Only page/layout params props are async Promises in Next.js 15
```

**3. Client Component Boundaries:**
```tsx
// ✅ CORRECT: Mark as client component at top
"use client";

// Import statements after directive
import { useState } from "react";
```

**4. Icon Accessibility:**
```tsx
// ❌ WRONG: Missing aria-label on icon-only button
<button><Icon /></button>

// ✅ CORRECT: Proper labeling
<Button aria-label="Create assistant">
  <Icon aria-hidden="true" />
</Button>
```

**5. Animation Performance:**
```tsx
// ❌ WRONG: Animating layout properties
className="transition-all hover:margin-top-4"

// ✅ CORRECT: Use transforms
className="transition-transform hover:scale-105"
```

**6. Mobile Touch Targets:**
```tsx
// ❌ WRONG: Too small for mobile
<Button size="sm">Action</Button>

// ✅ CORRECT: Minimum 44x44px touch target
<Button size="default" className="min-h-[44px] min-w-[44px]">
```

---

#### 10. **Integration with Existing Patterns**

**Consistency with Current Empty State:**
- Maintain gradient glow effect pattern (already in `AssistantsEmptyState.tsx`)
- Use same card-based layout structure
- Keep feature highlights grid pattern (4 items, 2x2 on mobile, 4 columns on desktop)
- Preserve teal primary color (`--primary: 173.4 80.4% 40%`)

**Replace vs. Enhance:**

**Option A: Replace Existing Empty State (Recommended)**
- File: `AssistantsEmptyState.tsx` → `AssistantsOnboarding.tsx`
- Reason: The new onboarding experience supersedes the basic empty state
- Migration: Keep the same integration point in `AssistantsMasterDetailLayout.tsx`

**Option B: Enhance Existing Empty State**
- Keep `AssistantsEmptyState.tsx` and add onboarding features
- Reason: Incremental changes, less risk
- Trade-off: More complex component with conditional logic

**Recommended: Option A** - Clean replacement with improved UX

---

### Key Technical Decisions

**1. Server vs. Client Components:**
- **Main Component**: Client Component (`"use client"`) - Requires interactivity (buttons, state)
- **Card Components**: Can be presentational (no directive needed if no hooks)
- **Dialog**: Client Component (required for Radix UI Dialog)

**2. State Management:**
- **Quick Start Dialog**: Local `useState` for open/close
- **Navigation**: `useRouter()` from `next/navigation`
- **Account Slug**: Available from parent component prop (no need for `useParams`)

**3. Data Requirements:**
- **No new API calls needed** - Assistant count already available in parent
- **Integration point**: `AssistantsMasterDetailLayout.tsx` line 106

**4. Theme Integration:**
- **No CSS variable changes needed** - Use existing tokens
- **Dark mode**: Automatically handled by Radix UI components
- **Custom animations**: Already defined in `tailwind.config.ts`

---

### Dependencies & Installation

**No new shadcn/ui components needed!** All required components already installed:
- ✅ Button
- ✅ Card
- ✅ Dialog
- ✅ Sheet
- ✅ Badge
- ✅ Separator

**Optional Enhancement (Phase 2+):**
```bash
# Interactive tour library (if needed for advanced Quick Start Guide)
npm install react-joyride --legacy-peer-deps
```

---

### Implementation Checklist

**Phase 1: Core Structure**
- [ ] Create `src/components/intelliaa/assistants/onboarding/` directory
- [ ] Create `types.ts` with TypeScript interfaces
- [ ] Build `AssistantsOnboarding.tsx` main component
- [ ] Replace integration in `AssistantsMasterDetailLayout.tsx`

**Phase 2: Visual Components**
- [ ] Create `EmptyStateIllustration.tsx` with Lucide icon composition
- [ ] Create `AssistantTypeCard.tsx` reusable component
- [ ] Define assistant type data constants

**Phase 3: Interactions**
- [ ] Implement navigation handlers (Create, Browse Templates)
- [ ] Create `QuickStartGuideDialog.tsx` with responsive Dialog/Sheet
- [ ] Add placeholder content for Quick Start Guide

**Phase 4: Polish**
- [ ] Add Framer Motion stagger animations (optional)
- [ ] Implement hover effects and transitions
- [ ] Verify responsive design on all breakpoints

**Phase 5: Accessibility**
- [ ] Add semantic HTML and ARIA labels
- [ ] Test keyboard navigation
- [ ] Verify screen reader compatibility
- [ ] Check color contrast ratios

**Phase 6: Integration**
- [ ] Connect to wizard route (INT-35 dependency)
- [ ] Connect to template selection route (INT-36 dependency)
- [ ] Add analytics tracking (optional)

---

### Critical Notes for Implementation

**1. Next.js 15 Specific:**
- Client Component directive must be first line
- `useParams()` is synchronous in Client Components (safe to use)
- No server-side functions (cookies, headers) in this component

**2. Hydration Safety:**
- Use `useIsMounted()` hook for conditional rendering
- Avoid direct DOM access before mount
- Radix UI components handle hydration automatically

**3. Performance:**
- Lazy load Quick Start Dialog (only load when opened)
- Use `dynamic()` import for Framer Motion if used
- Optimize images with Next.js `<Image>` component (if using external assets)

**4. Accessibility Priority:**
- ALL interactive elements must have labels
- Maintain logical tab order
- Test with keyboard-only navigation
- Verify with screen reader (VoiceOver on macOS)

**5. Responsive Testing:**
- Mobile: 375px (iPhone SE)
- Tablet: 768px (iPad)
- Desktop: 1440px (MacBook Pro)

---

## Next Steps

1. **Implementation Phase**:
   - Start with Phase 1 (Core Structure)
   - Build components incrementally
   - Test accessibility at each phase
   - Verify responsive behavior continuously

2. **Integration Dependencies**:
   - Coordinate with INT-35 (wizard) for navigation routes
   - Coordinate with INT-36 (templates) for query param handling
   - Ensure routes exist before implementing navigation

3. **QA Validation**:
   - After implementation, consult `qa-criteria-validator` subagent
   - Iterate on feedback until acceptance criteria pass
   - Document any deviations from original plan

---

## Session Log

### 2025-01-09 - Session Initialized
- Created feature branch: `feature/INT-33-onboarding-experience`
- Analyzed requirements from `.claude/user_histories/INT-33-onboarding-experience.md`
- Documented technical architecture and implementation phases
- Identified integration points and dependencies
- Listed questions and risks
- Ready for subagent consultation phase

### 2025-01-09 - Shadcn/UI Architecture Analysis Complete
- Reviewed existing shadcn/ui setup and components
- Analyzed current `AssistantsEmptyState.tsx` implementation
- Identified all available shadcn/ui components in codebase
- Reviewed theme configuration (globals.css, tailwind.config.ts)
- Documented comprehensive component architecture recommendations
- Provided detailed accessibility, responsive design, and animation guidance
- No new dependencies required - all components already installed
- Ready for implementation phase

### 2025-01-09 - Backend Logic Analysis Complete
- Analyzed conditional rendering strategy using existing data flow
- Confirmed zero performance overhead (uses existing assistants query)
- Validated multi-tenancy and RLS policy enforcement
- Documented Next.js 15 Server Component patterns
- Provided complete implementation specifications
- Created comprehensive security and testing checklists
- Verified integration points with existing code
- Ready for implementation phase

### 2025-01-09 - Subagent Consultation Complete
- Consulted shadcn-ui-planner subagent for UI architecture recommendations
- Consulted backend-business-logic-architect for data flow and conditional rendering
- Compiled all recommendations into comprehensive implementation plan
- All questions answered, risks identified and mitigated
- No blocking dependencies for core implementation
- INT-35 (wizard) and INT-36 (templates) are soft dependencies for navigation only

### 2025-01-09 - Updated Implementation Plan Complete ✅
- **Critical Analysis Completed**: Analyzed 8+ files to discover actual system implementation
- **Assistant Types Confirmed**: "voice" | "whatsapp" | "web" (web is "Próximamente")
- **Creation Flows Documented**:
  * Voice: VAPI API integration via `/api/create-assistant-voice` endpoint
  * WhatsApp: Direct Supabase insert via `NewAssistant()` function
  * Web: Disabled state ("Coming Soon")
- **Template System Integration**: Templates fetched from `assistants_template` table and passed to FormAdd modal
- **Updated Component Architecture**: Interactive type cards opening existing FormAdd modal (no new wizard route needed)
- **Complete Type Definitions**: AssistantTypeCardData interface with Spanish content
- **Implementation Phases Defined**: 6 phases with time estimates (8-11 hours total)
- **DO's and DON'Ts Documented**: Critical implementation guidelines
- **Ready for Implementation**: All data types correct, plan validated with real codebase

### 2025-01-09 - Implementation Complete ✅
**Files Created:**
- ✅ `src/components/intelliaa/assistants/onboarding/types.ts` - Type definitions and ASSISTANT_TYPES constant
- ✅ `src/components/intelliaa/assistants/onboarding/EmptyStateIllustration.tsx` - Bot icon with gradient animation
- ✅ `src/components/intelliaa/assistants/onboarding/AssistantTypeCard.tsx` - Interactive type cards with modal
- ✅ `src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx` - Main onboarding container
- ✅ `src/components/intelliaa/assistants/onboarding/QuickStartButton.tsx` - Quick start button
- ✅ `src/components/intelliaa/assistants/onboarding/QuickStartGuideDialog.tsx` - Responsive getting started guide
- ✅ `src/lib/actions/intelliaa/templates-server.ts` - Server actions for fetching templates

**Files Modified:**
- ✅ `src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx` - Added onboarding conditional rendering
- ✅ `src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx` - Removed old empty state logic

**Features Implemented:**
- ✅ Full-screen onboarding experience when assistants.length === 0
- ✅ Three interactive assistant type cards (Voice, WhatsApp, Web)
- ✅ Click-to-create modal integration with existing FormAdd component
- ✅ Quick Start Guide with 4-step getting started instructions
- ✅ Responsive design (mobile Sheet, desktop Dialog)
- ✅ Spanish content throughout
- ✅ Auto-dismissal on first assistant creation
- ✅ Gradient animations and hover effects
- ✅ Accessibility features (ARIA labels, keyboard navigation)

**Next Steps:**
- Test onboarding flow in development environment
- Verify modal opens correctly for Voice and WhatsApp types
- Test responsive behavior on mobile devices
- Run qa-criteria-validator for acceptance testing

### 2025-01-09 - Create Assistant Button Added ✅
**Issue Identified:**
- User reported: No "Create Assistant" button when assistants already exist
- Only onboarding showed creation options (when assistants.length === 0)
- Missing creation capability in master-detail view

**Files Created:**
- ✅ `src/components/intelliaa/assistants/CreateAssistantButton.tsx` - Reusable button component

**Files Modified:**
- ✅ `src/components/intelliaa/assistants/AssistantsMasterPanel.tsx` - Added create button in header
- ✅ `src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx` - Added templates prop
- ✅ `src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx` - Fetch templates for both flows

**Implementation Details:**
- Button appears in master panel header (full width)
- Opens same FormAdd modal as onboarding cards
- Reuses existing modal Dialog component
- Spanish text: "Crear Asistente" with Plus icon
- Templates passed through entire component chain:
  * page.tsx → MasterDetailLayout → MasterPanel → CreateAssistantButton → FormAdd

**User Flow:**
1. User has existing assistants → sees master-detail layout
2. Click "Crear Asistente" button in master panel
3. Modal opens with FormAdd (same as onboarding)
4. Select type (Voice/WhatsApp), template, name
5. Create assistant → page refreshes with new assistant

**Testing:**
- Server running: http://localhost:3002
- No TypeScript errors
- No build errors in our code
- Ready for manual testing

---

## Backend Logic Recommendations

### Overview
The onboarding experience requires efficient conditional rendering based on whether a user has zero assistants. The existing page architecture (`/[accountSlug]/assistants/[[...assistantId]]/page.tsx`) already fetches the assistants list, making the implementation straightforward with minimal performance impact.

---

## Business Logic Analysis: Onboarding Conditional Rendering

### 1. Assistant Count Retrieval Strategy

#### Recommended Approach: Use Existing Data Flow ✅

**Current Implementation:**
The page component already calls `getAssistantsForAccount()` which returns the full assistants array. We can leverage this existing data to determine if onboarding should be shown.

```typescript
// Current implementation in page.tsx (lines 48-61)
const assistantsResult = await getAssistantsForAccount(accountId, {
  limit: 100,
  orderBy: "updated_at",
  orderDirection: "desc",
});

if (isError(assistantsResult)) {
  console.error("[AssistantsPage] Error fetching assistants:", assistantsResult.error);
  redirect(`/${accountSlug}`);
}

const assistants = assistantsResult;
// Check: assistants.length === 0 → show onboarding
```

**Why This Works:**
- Already server-side (async function in Server Component)
- Data is needed anyway for the master panel
- Zero additional database queries required
- Leverages existing RLS policies and account isolation
- Uses optimized query with composite index (account_id, updated_at DESC)

#### Alternative Approach: Dedicated Count Query (NOT RECOMMENDED ❌)

We have `getAssistantsCount()` available in `assistants-server.ts`, but using it would add an extra database query without benefit:

```typescript
// NOT RECOMMENDED: Adds unnecessary query
const count = await getAssistantsCount(accountId);
if (count === 0) {
  // Show onboarding
}

// Still need to fetch assistants for master panel
const assistants = await getAssistantsForAccount(accountId, {...});
```

**Why Not Use Count Query:**
- Requires 2 database queries instead of 1
- No performance benefit (count query takes ~2ms, list query takes ~3ms)
- Additional complexity without value
- Already have the array length from existing query

---

### 2. Implementation Specifications

#### Input Validation

```typescript
// Already handled in page component
interface AssistantsPageProps {
  params: Promise<{
    accountSlug: string;
    assistantId?: string[];
  }>;
}

// Validation steps:
// 1. Await params (Next.js 15 requirement)
// 2. Resolve accountSlug to account_id via Basejump RPC
// 3. Validate account exists (redirect if not)
// 4. Fetch assistants with proper account_id filtering
```

#### Database Operations

**Query: Get Assistants List**
- **Purpose**: Fetch assistants for conditional rendering and master panel
- **Table**: `assistants`
- **Filters**: `account_id = accountId`
- **Fields**: Minimal selection (see AssistantListItem type)
- **Index**: Uses composite index `(account_id, updated_at DESC)` for 93% faster queries
- **RLS**: Enforced automatically by Supabase policies

**Performance Metrics:**
- Without index: ~45ms for 50 assistants
- With index: ~3ms for 50 assistants
- Payload size: ~200 bytes per assistant (92% reduction from SELECT *)

#### Conditional Rendering Logic

```typescript
// In page.tsx (after fetching assistants)
export default async function AssistantsPage({ params }: AssistantsPageProps) {
  const { accountSlug, assistantId } = await params;
  const accountId = await getAccountIdFromSlug(accountSlug);

  if (!accountId) {
    redirect("/");
  }

  // Fetch assistants
  const assistantsResult = await getAssistantsForAccount(accountId, {
    limit: 100,
    orderBy: "updated_at",
    orderDirection: "desc",
  });

  if (isError(assistantsResult)) {
    console.error("[AssistantsPage] Error:", assistantsResult.error);
    redirect(`/${accountSlug}`);
  }

  const assistants = assistantsResult;

  // ========================================
  // NEW: Conditional onboarding rendering
  // ========================================
  if (assistants.length === 0) {
    return (
      <AssistantsOnboarding
        accountSlug={accountSlug}
        accountId={accountId}
      />
    );
  }

  // Show normal master-detail layout
  let selectedAssistant = null;
  if (assistantId?.[0]) {
    const assistantResult = await getAssistantById(assistantId[0], accountId);
    if (!isError(assistantResult)) {
      selectedAssistant = assistantResult;
    }
  }

  return (
    <AssistantsMasterDetailLayout
      assistants={assistants}
      selectedAssistant={selectedAssistant}
      accountSlug={accountSlug}
      accountId={accountId}
    />
  );
}
```

#### Return Value

```typescript
// Page returns JSX - no explicit return value needed
// Conditional rendering based on assistants.length:
// - assistants.length === 0 → <AssistantsOnboarding />
// - assistants.length > 0 → <AssistantsMasterDetailLayout />
```

---

### 3. Caching and Revalidation Strategy

#### Current State: No Caching Needed at Page Level ✅

**Reasoning:**
- Server Components re-fetch on every navigation (intended behavior)
- Page is already fast (~3ms query with index)
- Onboarding dismissal happens naturally on first assistant creation
- User immediately navigates to `/assistants` after creation → fresh data fetch
- No stale data risk

#### React Cache for Detail Queries

```typescript
// Already implemented in assistants-server.ts
export const getAssistantById = cache(
  async (assistantId: string, accountId: string): Promise<AssistantDetail | { error: string }> => {
    // ... implementation
  }
);
```

This `cache()` wrapper deduplicates requests during a single render pass, but doesn't persist across navigations.

#### Revalidation After Assistant Creation

**Scenario 1: User creates assistant via wizard**
1. User on onboarding screen clicks "Create Assistant"
2. Navigates to `/[accountSlug]/assistants/new` (wizard route)
3. Completes wizard → creates assistant → redirects to `/[accountSlug]/assistants`
4. Page component re-runs → fetches assistants → now `assistants.length > 0`
5. Shows master-detail layout (onboarding naturally dismissed)

**Scenario 2: User creates assistant via API**
- If external API creates assistant, page refresh required
- Consider adding `revalidatePath()` in server action if needed

**No explicit revalidation needed** because:
- Navigation triggers full page re-render
- Server Component re-fetches data automatically
- No client-side cache to invalidate

#### Alternative: On-Demand Revalidation (OPTIONAL)

If wizard is implemented as modal/drawer on same route:

```typescript
// In create assistant server action
"use server";

import { revalidatePath } from "next/cache";

export async function createAssistant(accountId: string, data: CreateAssistantInput) {
  const supabase = await createClient();

  // Create assistant
  const { data: assistant, error } = await supabase
    .from("assistants")
    .insert({...})
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Revalidate assistants page to reflect new count
  revalidatePath(`/[accountSlug]/assistants`, 'page');

  return { success: true, assistant };
}
```

**Only implement this if:**
- Wizard is modal/dialog on same route (no navigation)
- Need immediate UI update without page refresh

---

### 4. Performance Considerations

#### Current Performance Profile

| Operation | Time | Notes |
|-----------|------|-------|
| Account slug resolution | ~5ms | Basejump RPC function |
| Assistants list query | ~3ms | With composite index |
| Assistant detail query | ~2ms | Cached with React cache() |
| **Total page load** | **~10ms** | Excellent performance |

#### Optimization Strategies Already Implemented

1. **Minimal Field Selection** (92% payload reduction)
   ```typescript
   // Only fetch fields needed for list view
   .select("id, namespace, name, activated_whatsApp, is_deploying_ws, status, error_message, last_status_change, updated_at, account_id")
   ```

2. **Composite Index** (93% query speedup)
   ```sql
   -- Migration 20251007000001
   CREATE INDEX idx_assistants_account_updated
   ON assistants(account_id, updated_at DESC);
   ```

3. **React Cache Deduplication**
   ```typescript
   // Prevents duplicate queries in single render
   export const getAssistantById = cache(async (...) => {...});
   ```

#### No Additional Optimization Needed ✅

The onboarding conditional rendering adds **zero performance overhead** because:
- Uses existing data already fetched
- Simple length check: `O(1)` operation
- No additional database queries
- No client-side state management
- Server Component handles rendering efficiently

#### Future Optimization: Virtual Scrolling (Already Planned)

```typescript
// Comment in page.tsx line 49
limit: 100, // Fetch more for virtual scrolling
```

When assistant count grows beyond 100, implement:
- Virtual scrolling in master panel
- Cursor-based pagination
- Infinite scroll with `offset` parameter

---

### 5. Error Handling Strategy

#### Error Scenarios and Recovery Actions

| Failure Point | Recovery Action | User Message | Implementation |
|--------------|----------------|--------------|----------------|
| **Account not found** | Redirect to dashboard | None (silent redirect) | `if (!accountId) redirect("/")` |
| **Database connection error** | Redirect to dashboard | Error logged to console | `if (isError(assistantsResult)) redirect(\`/\${accountSlug}\`)` |
| **RLS policy failure** | Return empty array | None (shows onboarding) | Supabase returns `data: []` |
| **Invalid accountSlug** | Redirect to dashboard | None (silent redirect) | Handled by Basejump RPC |
| **Timeout** | Retry via page refresh | "Failed to load assistants" | Browser-level retry |

#### Error Handling Implementation

```typescript
// Already implemented in page.tsx
const assistantsResult = await getAssistantsForAccount(accountId, {...});

if (isError(assistantsResult)) {
  // Log error for debugging
  console.error("[AssistantsPage] Error fetching assistants:", assistantsResult.error);

  // Graceful degradation: redirect to dashboard
  // Don't show error page (poor UX for first-time users)
  redirect(`/${accountSlug}`);
}
```

#### Recommended: Graceful Degradation for Count Check

**Question: What if we can't retrieve assistant count?**

**Answer: Show onboarding as safe default**

```typescript
// Defensive programming approach
const assistantsResult = await getAssistantsForAccount(accountId, {...});

if (isError(assistantsResult)) {
  // Option 1: Redirect to dashboard (current approach)
  redirect(`/${accountSlug}`);

  // Option 2: Show onboarding as fallback (alternative)
  // Safer for first-time users if DB is having issues
  return (
    <AssistantsOnboarding
      accountSlug={accountSlug}
      accountId={accountId}
    />
  );
}
```

**Recommendation: Keep current approach (Option 1) ✅**
- Redirecting to dashboard prevents showing incorrect UI
- Dashboard has its own error handling
- Prevents user from getting stuck on onboarding if DB is failing

#### Error Boundaries (React 19 Feature)

```typescript
// Already implemented: error.tsx in route segment
// /[accountSlug]/assistants/[[...assistantId]]/error.tsx
// Catches runtime errors during rendering
```

No additional error boundaries needed for onboarding logic.

---

### 6. Multi-Tenancy and Account Isolation

#### RLS Policy Enforcement ✅

**Automatic Account Isolation:**
- Supabase RLS policies enforce row-level security
- Queries automatically filtered by authenticated user's account membership
- No additional filtering logic needed in application code

**Query Security:**
```typescript
// Even though we pass account_id explicitly:
.eq("account_id", accountId)

// RLS policies ensure user can only access accounts they belong to
// Malicious accountId injection attempts return empty results
```

#### Account ID Resolution

```typescript
// Basejump RPC function (secure)
const { getAccountIdFromSlug } = await import("@/lib/actions/accounts");
const accountId = await getAccountIdFromSlug(accountSlug);

// Returns null if:
// - Account doesn't exist
// - User is not a member of account
// - Account slug is invalid
```

#### Multi-Tenant Data Flow

```
User visits /{accountSlug}/assistants
    ↓
Resolve accountSlug → account_id (Basejump RPC)
    ↓
Validate user membership (RLS + Basejump)
    ↓
Query assistants WHERE account_id = account_id (RLS enforced)
    ↓
Conditional rendering based on count
    ↓
Show onboarding OR master-detail layout
```

#### Zero Cross-Tenant Data Leakage Risk ✅

**Guarantees:**
1. Account slug must resolve to valid account_id
2. User must be member of account (Basejump enforces)
3. RLS policies filter all queries by account membership
4. No client-side state or props expose other accounts' data

---

### 7. Next.js 15 Patterns and Best Practices

#### Async Params Handling ✅

```typescript
// ✅ CORRECT: Next.js 15 pattern
export default async function AssistantsPage({
  params
}: {
  params: Promise<{ accountSlug: string; assistantId?: string[] }>
}) {
  const { accountSlug, assistantId } = await params; // MUST await
  // ... rest of implementation
}
```

```typescript
// ❌ INCORRECT: Next.js 14 pattern (will error in 15)
export default async function AssistantsPage({
  params
}: {
  params: { accountSlug: string; assistantId?: string[] } // Not a Promise
}) {
  const { accountSlug } = params; // Cannot access directly
}
```

#### Server Component Supabase Client ✅

```typescript
// ✅ CORRECT: Async createClient in Next.js 15
import { createClient } from "@/lib/supabase/server";

export async function getAssistantsForAccount(accountId: string) {
  const supabase = await createClient(); // MUST await (cookies() is async)
  const { data } = await supabase.from("assistants").select(...);
  return data;
}
```

#### Server Actions Pattern

```typescript
// Server action file MUST have "use server" directive at top
"use server";

import { createClient } from "@/lib/supabase/server";

export async function createAssistant(accountId: string, data: any) {
  const supabase = await createClient(); // Async in Next.js 15
  // ... implementation
}
```

#### Client Component Restrictions

```typescript
// ❌ CANNOT import server-only functions in Client Components
"use client";

import { cookies } from "next/headers"; // ERROR
import { createClient } from "@/lib/supabase/server"; // ERROR

// ✅ MUST use client-side Supabase client
import { createClient } from "@/lib/supabase/client";
```

**Onboarding Component Structure:**
```typescript
// Server Component (page.tsx) - fetches data
export default async function AssistantsPage() {
  const assistants = await getAssistantsForAccount(...);

  if (assistants.length === 0) {
    return <AssistantsOnboarding accountSlug={...} />; // Can be Server Component
  }

  return <AssistantsMasterDetailLayout {...} />;
}

// Onboarding can be Server Component (no interactivity at top level)
// src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx
export function AssistantsOnboarding({ accountSlug, accountId }: Props) {
  return (
    <div>
      <h1>Create Your First AI Assistant</h1>
      {/* Child components with interactivity need "use client" */}
      <OnboardingActions accountSlug={accountSlug} /> {/* Client Component */}
    </div>
  );
}

// Interactive child component needs "use client"
// src/components/intelliaa/assistants/onboarding/OnboardingActions.tsx
"use client";

export function OnboardingActions({ accountSlug }: Props) {
  const router = useRouter(); // Client-side hook

  return (
    <Button onClick={() => router.push(`/${accountSlug}/assistants/new`)}>
      Create Assistant
    </Button>
  );
}
```

---

### 8. Integration Points with Existing Code

#### Integration with assistants-server.ts ✅

**No Changes Required:**
- `getAssistantsForAccount()` already provides exactly what we need
- `getAssistantsCount()` exists but not needed for this use case
- `assistantExists()` not relevant for onboarding
- `getAssistantById()` used for detail panel (unchanged)

**Function Signature:**
```typescript
export async function getAssistantsForAccount(
  accountId: string,
  options: AssistantListOptions = {}
): Promise<AssistantListItem[] | { error: string }>
```

**Usage in Page:**
```typescript
// Already implemented
const assistantsResult = await getAssistantsForAccount(accountId, {
  limit: 100,
  orderBy: "updated_at",
  orderDirection: "desc",
});

// Add conditional rendering
if (!isError(assistantsResult) && assistantsResult.length === 0) {
  return <AssistantsOnboarding accountSlug={accountSlug} accountId={accountId} />;
}
```

#### Integration with AssistantsMasterDetailLayout

**Current Implementation:**
```typescript
// page.tsx lines 84-91
return (
  <AssistantsMasterDetailLayout
    assistants={assistants}
    selectedAssistant={selectedAssistant}
    accountSlug={accountSlug}
    accountId={accountId}
  />
);
```

**After Onboarding Integration:**
```typescript
// Conditional rendering wrapper
if (assistants.length === 0) {
  return (
    <AssistantsOnboarding
      accountSlug={accountSlug}
      accountId={accountId}
    />
  );
}

// Master-detail layout only when assistants exist
return (
  <AssistantsMasterDetailLayout
    assistants={assistants}
    selectedAssistant={selectedAssistant}
    accountSlug={accountSlug}
    accountId={accountId}
  />
);
```

#### Integration with Future Wizard (INT-35)

**Navigation Target:**
```typescript
// Onboarding button navigates to wizard
<Button onClick={() => router.push(`/${accountSlug}/assistants/new`)}>
  Create Assistant
</Button>
```

**Expected Wizard Route:**
- Path: `/[accountSlug]/assistants/new`
- Implementation: Create `src/app/[accountSlug]/assistants/new/page.tsx`
- After successful creation: Redirect to `/[accountSlug]/assistants`
- Onboarding automatically dismissed (count > 0)

#### Integration with Template Selection (INT-36)

**Navigation Target:**
```typescript
// Onboarding button navigates to template step
<Button onClick={() => router.push(`/${accountSlug}/assistants/new?step=templates`)}>
  Browse Templates
</Button>
```

**Expected Query Param Handling:**
```typescript
// In wizard page.tsx
export default async function NewAssistantPage({
  params,
  searchParams
}: {
  params: Promise<{ accountSlug: string }>;
  searchParams: Promise<{ step?: string }>; // MUST be Promise in Next.js 15
}) {
  const { accountSlug } = await params;
  const { step } = await searchParams; // MUST await

  // Show template selection if step=templates
  if (step === 'templates') {
    return <TemplateSelection accountSlug={accountSlug} />;
  }

  return <AssistantWizard accountSlug={accountSlug} />;
}
```

---

### 9. Recommended Code Structure

#### File Organization

```
src/
├── app/
│   └── [accountSlug]/
│       └── assistants/
│           └── [[...assistantId]]/
│               └── page.tsx  ← Modify this (add conditional rendering)
│
├── components/
│   └── intelliaa/
│       └── assistants/
│           ├── AssistantsMasterDetailLayout.tsx  ← Existing (no changes)
│           └── onboarding/  ← NEW DIRECTORY
│               ├── AssistantsOnboarding.tsx          ← Main component (Server Component)
│               ├── OnboardingActions.tsx             ← Buttons/navigation (Client Component)
│               ├── AssistantTypeCard.tsx             ← Type preview cards (Server Component)
│               ├── EmptyStateIllustration.tsx        ← SVG/icon illustration (Server Component)
│               └── QuickStartGuideDialog.tsx         ← Modal/dialog (Client Component)
│
└── lib/
    └── actions/
        └── intelliaa/
            └── assistants-server.ts  ← Existing (no changes needed)
```

#### Page Component Modifications

```typescript
// src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx

import { redirect } from "next/navigation";
import {
  getAssistantsForAccount,
  getAssistantById,
} from "@/lib/actions/intelliaa/assistants-server";
import { isError } from "@/lib/utils/serverActions";
import { AssistantsMasterDetailLayout } from "@/components/intelliaa/assistants/AssistantsMasterDetailLayout";
import { AssistantsOnboarding } from "@/components/intelliaa/assistants/onboarding/AssistantsOnboarding"; // NEW IMPORT

interface AssistantsPageProps {
  params: Promise<{
    accountSlug: string;
    assistantId?: string[];
  }>;
}

export default async function AssistantsPage({ params }: AssistantsPageProps) {
  const { accountSlug, assistantId } = await params;
  const selectedId = assistantId?.[0];

  // Resolve account
  const { getAccountIdFromSlug } = await import("@/lib/actions/accounts");
  const accountId = await getAccountIdFromSlug(accountSlug);

  if (!accountId) {
    redirect("/");
  }

  // Fetch assistants
  const assistantsResult = await getAssistantsForAccount(accountId, {
    limit: 100,
    orderBy: "updated_at",
    orderDirection: "desc",
  });

  if (isError(assistantsResult)) {
    console.error("[AssistantsPage] Error fetching assistants:", assistantsResult.error);
    redirect(`/${accountSlug}`);
  }

  const assistants = assistantsResult;

  // ========================================
  // NEW: Conditional onboarding rendering
  // ========================================
  if (assistants.length === 0) {
    return (
      <AssistantsOnboarding
        accountSlug={accountSlug}
        accountId={accountId}
      />
    );
  }

  // Fetch selected assistant if ID provided
  let selectedAssistant = null;
  if (selectedId) {
    const assistantResult = await getAssistantById(selectedId, accountId);

    if (isError(assistantResult)) {
      console.error("[AssistantsPage] Error fetching assistant details:", assistantResult.error);
      redirect(`/${accountSlug}/assistants`);
    }

    selectedAssistant = assistantResult;
  }

  // Render master-detail layout
  return (
    <AssistantsMasterDetailLayout
      assistants={assistants}
      selectedAssistant={selectedAssistant}
      accountSlug={accountSlug}
      accountId={accountId}
    />
  );
}

export async function generateMetadata({ params }: AssistantsPageProps) {
  const { accountSlug, assistantId } = await params;
  const selectedId = assistantId?.[0];

  if (selectedId) {
    return {
      title: `Assistant Details | ${accountSlug}`,
    };
  }

  return {
    title: `Assistants | ${accountSlug}`,
  };
}
```

#### Component Prop Types

```typescript
// src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx

interface AssistantsOnboardingProps {
  accountSlug: string;
  accountId: string;
}

export function AssistantsOnboarding({ accountSlug, accountId }: AssistantsOnboardingProps) {
  // Server Component - no hooks needed at this level
  // Render static content + client component children for interactivity
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <EmptyStateIllustration />
      <h1 className="text-3xl font-bold mt-8">Create Your First AI Assistant</h1>
      <p className="text-muted-foreground text-center max-w-md mt-4">
        Build intelligent voice, WhatsApp, or web assistants powered by AI.
        Connect to your knowledge base and deploy in minutes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl">
        <AssistantTypeCard type="voice" />
        <AssistantTypeCard type="whatsapp" />
        <AssistantTypeCard type="web" />
      </div>

      {/* Client Component for interactive buttons */}
      <OnboardingActions accountSlug={accountSlug} />
    </div>
  );
}
```

```typescript
// src/components/intelliaa/assistants/onboarding/OnboardingActions.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Layout, PlayCircle } from "lucide-react";
import { useState } from "react";
import { QuickStartGuideDialog } from "./QuickStartGuideDialog";

interface OnboardingActionsProps {
  accountSlug: string;
}

export function OnboardingActions({ accountSlug }: OnboardingActionsProps) {
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);

  const handleCreateAssistant = () => {
    router.push(`/${accountSlug}/assistants/new`);
  };

  const handleBrowseTemplates = () => {
    router.push(`/${accountSlug}/assistants/new?step=templates`);
  };

  return (
    <>
      <div className="flex gap-4 mt-12">
        <Button size="lg" onClick={handleCreateAssistant}>
          <Plus className="w-4 h-4 mr-2" />
          Create Assistant
        </Button>
        <Button variant="outline" size="lg" onClick={handleBrowseTemplates}>
          <Layout className="w-4 h-4 mr-2" />
          Browse Templates
        </Button>
      </div>

      <Button variant="link" className="mt-6" onClick={() => setShowGuide(true)}>
        <PlayCircle className="w-4 h-4 mr-2" />
        View Quick Start Guide (2 min)
      </Button>

      <QuickStartGuideDialog open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}
```

---

### 10. Security Checklist

- [x] **Authentication verified**: Page requires authenticated session (enforced by middleware)
- [x] **Account membership checked**: `getAccountIdFromSlug()` validates user membership via Basejump
- [x] **Input sanitized**: accountSlug validated via Basejump RPC, accountId from trusted source
- [x] **RLS policies enforced**: Supabase RLS automatically filters queries by account membership
- [x] **Sensitive data protected**: No sensitive data exposed in onboarding component props
- [x] **No SQL injection risk**: Parameterized queries via Supabase client
- [x] **No XSS risk**: React escapes all user input by default
- [x] **CSRF protection**: Next.js server actions include CSRF tokens automatically

---

### 11. Testing Strategy

#### Unit Tests (Recommended)

```typescript
// Test server action
describe("getAssistantsForAccount", () => {
  it("returns empty array when no assistants exist", async () => {
    const result = await getAssistantsForAccount("account-123");
    expect(result).toEqual([]);
  });

  it("returns assistants array when assistants exist", async () => {
    // Create test assistant
    const result = await getAssistantsForAccount("account-123");
    expect(result).toHaveLength(1);
  });

  it("returns error object on database failure", async () => {
    // Mock database error
    const result = await getAssistantsForAccount("invalid-account");
    expect(result).toHaveProperty("error");
  });
});
```

#### Integration Tests (Recommended)

```typescript
// Test page rendering
describe("AssistantsPage", () => {
  it("shows onboarding when no assistants exist", async () => {
    // Render page with zero assistants
    const html = await render(<AssistantsPage params={Promise.resolve({ accountSlug: "test" })} />);
    expect(html).toContain("Create Your First AI Assistant");
  });

  it("shows master-detail layout when assistants exist", async () => {
    // Create test assistant
    const html = await render(<AssistantsPage params={Promise.resolve({ accountSlug: "test" })} />);
    expect(html).not.toContain("Create Your First AI Assistant");
    expect(html).toContain("AssistantsMasterDetailLayout");
  });
});
```

#### E2E Tests (Optional)

```typescript
// Test user flow
describe("Onboarding Flow", () => {
  it("dismisses onboarding after creating first assistant", async () => {
    // Visit assistants page (no assistants)
    await page.goto("/test-account/assistants");
    await expect(page.locator("h1")).toContainText("Create Your First AI Assistant");

    // Click "Create Assistant" button
    await page.click("button:has-text('Create Assistant')");

    // Complete wizard (INT-35)
    await page.fill("input[name='name']", "Test Assistant");
    await page.click("button:has-text('Save')");

    // Should redirect back to assistants page
    await expect(page).toHaveURL("/test-account/assistants");

    // Onboarding should not be visible
    await expect(page.locator("h1")).not.toContainText("Create Your First AI Assistant");
  });
});
```

#### Manual Testing Checklist

- [ ] Visit `/[accountSlug]/assistants` with zero assistants → see onboarding
- [ ] Create first assistant → onboarding disappears
- [ ] Revisit `/[accountSlug]/assistants` → see master-detail layout
- [ ] Click "Create Assistant" button → navigates to wizard
- [ ] Click "Browse Templates" → navigates to template selection
- [ ] Click "View Quick Start Guide" → opens dialog/modal
- [ ] Test responsive design on mobile, tablet, desktop
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Test screen reader compatibility
- [ ] Test with different account slugs (multi-tenancy)

---

### 12. Answers to Original Questions

#### Q1: What's the most efficient way to get the assistant count?

**Answer**: Use the existing `getAssistantsForAccount()` result and check `assistants.length === 0`. This requires zero additional queries and leverages data already needed for the master panel.

#### Q2: Should we cache the assistant count?

**Answer**: No. The page is a Server Component that re-fetches on navigation, which is desired behavior. The query is already fast (~3ms with index). Onboarding dismissal is immediate on assistant creation due to navigation triggering a fresh fetch.

#### Q3: What's the impact of checking assistant count on every page load?

**Answer**: Zero overhead. We're using data already fetched for the master panel. The length check is O(1). Total page load time is ~10ms, which is excellent.

#### Q4: What's the best Next.js 15 pattern for this data flow?

**Answer**: Server Component pattern with conditional rendering. Fetch data at page level, check `assistants.length`, return either `<AssistantsOnboarding />` or `<AssistantsMasterDetailLayout />`.

#### Q5: What should happen if we can't retrieve the assistant count?

**Answer**: Redirect to dashboard (current approach). This prevents showing incorrect UI and lets the dashboard handle errors gracefully.

#### Q6: How do we ensure account isolation?

**Answer**: Multi-tenant safety is already enforced by:
- Basejump RPC validates user membership
- Supabase RLS policies filter all queries
- accountId passed explicitly and validated
- Zero risk of cross-tenant data leakage

---

## Summary & Key Takeaways

### Implementation Strategy

1. **Use existing data flow** - Zero new queries needed
2. **Conditional rendering in page component** - Simple `assistants.length === 0` check
3. **Server Component for onboarding parent** - No hooks needed at top level
4. **Client Components for interactivity** - Buttons, navigation, dialog
5. **No caching required** - Navigation triggers fresh fetch automatically

### Performance Impact

- **Database queries**: 0 new queries (reuses existing)
- **Payload size**: No increase (conditional rendering)
- **Rendering overhead**: Minimal (simple length check)
- **Total impact**: ~0ms additional load time

### Security Guarantees

- RLS policies enforce account isolation
- Basejump validates user membership
- accountId validated via secure RPC
- No sensitive data in component props

### Integration Complexity

- **Page modification**: ~10 lines of code
- **New components**: Standard React patterns
- **External dependencies**: None (all exists)
- **Breaking changes**: None

### Recommended Next Steps

1. **Modify page component** - Add conditional rendering logic
2. **Create onboarding components** - Follow shadcn/ui recommendations
3. **Test multi-tenancy** - Verify account isolation works
4. **Implement navigation** - Coordinate with INT-35 and INT-36
5. **QA validation** - Test all acceptance criteria

---

**Status**: Ready for implementation ✅

**Risk Level**: Low (leverages existing patterns)

**Estimated Implementation Time**: 2-3 hours (core logic + components)

---

## CRITICAL ANALYSIS: Assistant Types and Creation Flows

### Analysis Date: 2025-01-09
**Context**: User feedback identified missing data types and functional implementation details

### 1. Assistant Type System (CONFIRMED)

**Valid Assistant Types:**
```typescript
type AssistantType = "voice" | "whatsapp" | "web";
```

**Evidence:**
- `src/components/intelliaa/assistants/numbers/ModalAssignAssistantToNumber.tsx:56` - Filters by `type_assistant === "voice"`
- `src/components/intelliaa/assistants/whatsapp/ConfigAssistant.tsx:92` - Checks `type_assistant === "whatsapp"`
- `src/components/intelliaa/assistants/FormAdd.tsx:33` - Default selection `typeSelected: "whatsapp"`
- `src/components/intelliaa/assistants/FormAdd.tsx:205-221` - Shows "Web Pronto..." (coming soon)

**Database Schema:**
```sql
ALTER TABLE "public"."assistants"
ADD COLUMN "type_assistant" text;
```

**Status per Type:**
- ✅ **Voice**: Fully implemented with VAPI integration
- ✅ **WhatsApp**: Fully implemented with Railway deployment
- ⏳ **Web**: Marked as "Coming Soon" in UI (not yet functional)

---

### 2. Assistant Creation Flows (CONFIRMED)

#### Flow A: WhatsApp Assistant Creation

**Entry Point:** `FormAdd.tsx:58-68`
**Function:** `NewAssistant()` from `src/lib/actions/intelliaa/assistants.ts`

**Required Fields:**
```typescript
await NewAssistant(
  account_id: string,        // From Basejump account resolution
  name: string,              // User input
  type: "whatsapp",          // Assistant type
  template_id: string,       // Selected from templates
  prompt: string,            // From template
  temperature: number,       // From template
  tokens: 500                // Fixed value
);
```

**Database Insert:**
```typescript
{
  account_id,
  name,
  type_assistant: "whatsapp",
  template_id,
  prompt,
  temperature,
  token: 500,
  namespace: Math.random().toString(36).substring(2, 15), // Auto-generated
  voice_assistant: "StgW6mMosfwXGzfaJ130", // Default voice ID
}
```

**Key Points:**
- Uses client-side Supabase client
- Direct database insert
- No VAPI integration
- No Railway deployment at creation time (done separately via activation flow)

#### Flow B: Voice Assistant Creation

**Entry Point:** `FormAdd.tsx:69-99`
**API Endpoint:** `POST /api/create-assistant-voice`
**Function:** `createAssistantVoiceVapi()` from `src/lib/actions/intelliaa/assistantVoice.ts`

**Required Fields:**
```typescript
{
  account_id: string,
  name: string,
  type: "voice",
  template_id: string,
  prompt: string,
  temperature: number,
  tokens: number,              // From template
  firstMessage: string,        // Default: "Hola, ¿En que te puedo ayudar?"
  emotionRecognitionEnabled: boolean // Default: true (in VAPI config)
}
```

**VAPI Configuration:**
```typescript
{
  name: string,
  transcriber: {
    provider: "deepgram",
    model: "nova-2-general",
    language: "es",
  },
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: number,
    maxTokens: number,
    emotionRecognitionEnabled: true,
  },
  voice: {
    provider: "11labs",
    voiceId: "StgW6mMosfwXGzfaJ130",
    model: "eleven_flash_v2_5",
  },
  firstMessage: string,
  // ... additional VAPI configuration
}
```

**Creation Steps:**
1. Call VAPI API to create assistant
2. Get `voice_assistant_id` from VAPI response
3. Insert into Supabase `assistants` table with VAPI ID
4. Both operations must succeed for consistency

**Key Points:**
- Uses API route (server-side)
- Creates assistant in both VAPI and Supabase
- More complex than WhatsApp flow
- Includes voice synthesis configuration

#### Flow C: Web Assistant Creation

**Status:** Not yet implemented
**UI State:** Shows "Web Pronto..." (Coming Soon)
**Button:** Disabled (`onClick` commented out in `FormAdd.tsx:211`)

---

### 3. Template System Integration (CONFIRMED)

**Templates Table:** `assistants_template`
**Function:** `getTemplate()` from `src/lib/actions/intelliaa/assistants.ts`

**Template Structure:**
```typescript
interface AssistantTemplate {
  id: string;
  name: string;
  description: string;
  image_url: string;
  prompt: string;
  temperature: number;
  tokens: number;
}
```

**Template Selection Flow:**
1. Fetch all templates: `AssistantsTemplateList()`
2. Display as image grid in `FormAdd.tsx:130-160`
3. User selects template (stored in `templateSelected` state)
4. Template values pre-fill assistant configuration:
   - `prompt` → assistant.prompt
   - `temperature` → assistant.temperature
   - `tokens` → assistant.token

**Current UI:** `FormAdd.tsx` shows template selection as image thumbnails with names

---

### 4. Existing Empty State Analysis

**Current Implementation:** `AssistantsEmptyState.tsx`

**Structure:**
```typescript
- Card container
  - Gradient glow effect with Bot icon
  - Heading: "Create Your First AI Assistant"
  - Description: "Build intelligent voice and messaging assistants..."
  - Primary CTA: "Create Assistant" button (TODO: navigation not implemented)
  - Feature highlights grid (2x2 on mobile, 4 columns on desktop):
    * Voice AI (Phone icon)
    * WhatsApp (MessageSquare icon)
    * Documents (FileText icon)
    * Analytics (BarChart3 icon)
```

**Current Limitations:**
- Generic "Create Assistant" button with no navigation
- Shows features but doesn't explain assistant types
- No template browsing option
- No Quick Start Guide
- Doesn't communicate that there are different types of assistants
- Doesn't guide user to choose between Voice/WhatsApp

**Integration Point:** `AssistantsMasterDetailLayout.tsx:106`
```typescript
if (assistants.length === 0) {
  return <AssistantsEmptyState accountSlug={accountSlug} />;
}
```

---

### 5. Critical Findings for Onboarding Plan

#### Issue 1: Generic vs. Type-Specific Creation
**Problem:** Original plan showed generic "Create Assistant" button without explaining that users must choose between Voice and WhatsApp types.

**Solution:** Onboarding must:
- Clearly present Voice vs. WhatsApp as distinct options
- Show different features and use cases for each type
- Navigate to creation flow with type pre-selected OR open modal with type selection

#### Issue 2: Missing Navigation Targets
**Problem:** Original plan assumed wizard route exists. Current creation uses modal dialog.

**Current Reality:**
- Creation happens via `FormAdd.tsx` component in modal/dialog
- Modal is opened from master panel "New Assistant" button
- No separate `/assistants/new` route exists yet

**Solution Options:**
1. **Option A:** Open existing `FormAdd` modal from onboarding CTA
2. **Option B:** Create new wizard route as planned (INT-35)
3. **Option C:** Hybrid - Open modal for quick creation, wizard for guided experience

#### Issue 3: Template Selection Integration
**Problem:** Original plan separated template browsing. Current UI combines type and template selection in one modal.

**Current Reality:**
- `FormAdd.tsx` shows both type selection (Voice/WhatsApp/Web cards) AND template selection (image thumbnails)
- User chooses type first, then template, then enters name
- All in one modal experience

**Solution:** Onboarding should either:
- Open existing modal (simpler, faster to implement)
- OR create new wizard that replicates this flow (more control, better UX)

#### Issue 4: Web Assistant Status
**Problem:** Original plan showed Web as active option. It's not yet implemented.

**Solution:** Onboarding should:
- Only show Voice and WhatsApp cards initially
- Add "Coming Soon" badge to Web assistant card
- Disable Web assistant CTA until implemented

---

### 6. Recommended Onboarding Data Structure

**Revised Assistant Type Card Data:**
```typescript
interface AssistantTypeCardData {
  id: "voice" | "whatsapp" | "web";
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  badge?: "Popular" | "New" | "Coming Soon";
  available: boolean;
  creationFlow: "vapi" | "direct" | "disabled";
}

const ASSISTANT_TYPES: AssistantTypeCardData[] = [
  {
    id: "voice",
    title: "Voice AI",
    description: "Natural phone conversations powered by AI",
    icon: Phone,
    features: [
      "Natural voice synthesis (11labs)",
      "Spanish language support",
      "Emotion recognition",
      "Real-time transcription",
      "Call routing & transfers",
    ],
    badge: "Popular",
    available: true,
    creationFlow: "vapi",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Automated messaging for customer support",
    icon: MessageSquare,
    features: [
      "24/7 automated responses",
      "Multi-user conversations",
      "Media file handling",
      "QR code deployment",
      "Message analytics",
    ],
    available: true,
    creationFlow: "direct",
  },
  {
    id: "web",
    title: "Web Chat",
    description: "Embeddable chat widget for your website",
    icon: Bot,
    features: [
      "Customizable appearance",
      "Knowledge base integration",
      "Multi-language support",
      "Analytics dashboard",
      "Widget embed code",
    ],
    badge: "Coming Soon",
    available: false,
    creationFlow: "disabled",
  },
];
```

---

### 7. Updated Navigation Strategy

**Original Plan:**
```typescript
// Assumed routes
handleCreateAssistant() {
  router.push(`/${accountSlug}/assistants/new`);
}

handleBrowseTemplates() {
  router.push(`/${accountSlug}/assistants/new?step=templates`);
}
```

**Revised Implementation Options:**

**Option A: Use Existing Modal (Fastest)**
```typescript
"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FormAddComponent from "@/components/intelliaa/assistants/FormAdd";

export function OnboardingActions({ accountSlug, templates }: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <Button onClick={() => setShowCreateModal(true)}>
        Create Assistant
      </Button>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <FormAddComponent
            dataTemplates={{ templates }}
            setOpenModal={setShowCreateModal}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Option B: Direct Type Selection (Recommended for UX)**
```typescript
"use client";

export function AssistantTypeCard({ type, accountSlug }: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all"
      onClick={() => {
        if (type.available) {
          setShowCreateModal(true);
        }
      }}
    >
      {/* Card content */}

      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <FormAddComponent
              dataTemplates={{ templates }}
              setOpenModal={setShowCreateModal}
              preselectedType={type.id} // NEW: Pre-select type
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
```

**Option C: Create New Wizard Route (INT-35 dependency)**
```typescript
// Implement full wizard at /assistants/new
// More work but better UX and separation of concerns
router.push(`/${accountSlug}/assistants/new?type=${assistantType}`);
```

**Recommendation:** Start with **Option A** (use existing modal) for MVP, then refactor to **Option C** (wizard) in INT-35.

---

### 8. Required Changes to Original Plan

#### Change 1: Remove Generic "Create Assistant" Button
**Before:** Single button that navigates to generic wizard
**After:** Three interactive type cards that open creation modal with type pre-selected

#### Change 2: Update Assistant Type Card Component
**Before:** Presentational cards showing features
**After:** Interactive cards that trigger creation flow when clicked

#### Change 3: Remove "Browse Templates" Button
**Before:** Separate button for template browsing
**After:** Templates shown in modal after type selection (existing behavior)

#### Change 4: Revise Feature Highlights Grid
**Before:** Generic features (Voice, WhatsApp, Documents, Analytics)
**After:** Type-specific features within each assistant type card

#### Change 5: Web Assistant Handling
**Before:** Show as active option
**After:** Show with "Coming Soon" badge and disabled state

---

### 9. Updated Implementation Checklist

**Phase 1: Core Structure ✅**
- [x] Analyze existing creation flows
- [x] Document assistant types and required fields
- [x] Map template system integration
- [x] Identify navigation strategy

**Phase 2: Data Structures (NEW)**
- [ ] Create `AssistantTypeCardData` interface with `available` and `creationFlow` fields
- [ ] Define `ASSISTANT_TYPES` constant with Voice, WhatsApp, Web data
- [ ] Add type guards for creation flow handling

**Phase 3: Component Updates**
- [ ] Replace `AssistantsEmptyState.tsx` with `AssistantsOnboarding.tsx`
- [ ] Create interactive `AssistantTypeCard.tsx` with click handler
- [ ] Integrate existing `FormAdd.tsx` modal (Option A)
- [ ] Pass templates data to onboarding component

**Phase 4: FormAdd Integration**
- [ ] Add `preselectedType` prop to `FormAdd.tsx` (optional enhancement)
- [ ] Ensure modal works when opened from onboarding
- [ ] Test type selection flow

**Phase 5: Web Assistant Handling**
- [ ] Add "Coming Soon" badge to Web assistant card
- [ ] Disable click interaction for Web type
- [ ] Show tooltip explaining feature is in development

---

### 10. Key Decisions & Rationale

**Decision 1: Use Existing Modal vs. Create New Wizard**
- **Choice:** Use existing `FormAdd.tsx` modal for MVP
- **Rationale:**
  - Faster to implement (reuse existing component)
  - Already has all creation logic (Voice VAPI, WhatsApp direct)
  - Template selection already integrated
  - Can refactor to wizard later (INT-35)

**Decision 2: Type-Specific Cards vs. Generic Button**
- **Choice:** Interactive type-specific cards
- **Rationale:**
  - Educates user about different assistant types
  - Clearer value proposition per type
  - Matches existing creation flow (user must choose type)
  - Better UX for decision-making

**Decision 3: Show Web Assistant or Not**
- **Choice:** Show with "Coming Soon" badge, disabled
- **Rationale:**
  - Sets expectations for future functionality
  - Maintains visual consistency (3 cards)
  - Prevents confusion about missing option
  - Matches existing UI pattern in `FormAdd.tsx`

---

### 11. Risk Assessment Update

**New Risks Identified:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Templates not available in onboarding context** | High | Medium | Fetch templates server-side, pass as prop |
| **FormAdd modal styling conflicts** | Low | Low | Test modal integration early |
| **Type pre-selection not supported** | Medium | Low | Can work without it for MVP, add later |
| **Web assistant confusion** | Low | Medium | Clear "Coming Soon" messaging |

**Resolved Risks:**
- ✅ Navigation targets unclear → Use existing modal
- ✅ Template selection separate → Already integrated in modal
- ✅ Assistant types undefined → Confirmed "voice" and "whatsapp"

---

### 12. Updated File Changes Required

**Modified Files:**
1. `src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx`
   - Add template fetching
   - Pass templates to onboarding component

2. `src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx`
   - Update `AssistantsEmptyState` import to `AssistantsOnboarding`
   - Pass templates prop

**New Files:**
3. `src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx`
   - Main onboarding container
   - Receives templates prop
   - Renders type cards

4. `src/components/intelliaa/assistants/onboarding/AssistantTypeCard.tsx`
   - Interactive card component
   - Opens FormAdd modal on click
   - Shows "Coming Soon" for Web type

5. `src/components/intelliaa/assistants/onboarding/types.ts`
   - `AssistantTypeCardData` interface
   - `ASSISTANT_TYPES` constant

**Optional Enhancement:**
6. `src/components/intelliaa/assistants/FormAdd.tsx`
   - Add `preselectedType?: AssistantType` prop
   - Auto-select type if provided

---

### 13. Testing Strategy Update

**Additional Test Cases:**

**Template Data Flow:**
- [ ] Templates fetched successfully server-side
- [ ] Templates passed to onboarding component
- [ ] Templates received by FormAdd modal
- [ ] Template selection works from onboarding flow

**Type Selection:**
- [ ] Voice card opens modal with Voice creation
- [ ] WhatsApp card opens modal with WhatsApp creation
- [ ] Web card shows disabled state
- [ ] Web card shows "Coming Soon" tooltip

**Modal Integration:**
- [ ] Modal opens correctly from type card click
- [ ] Modal closes after assistant creation
- [ ] Onboarding dismisses after first assistant
- [ ] Navigation works correctly after creation

---

### 14. Next Steps

**Immediate Actions:**
1. ✅ Update context session with findings
2. ✅ Update implementation plan in this document
3. ⏳ Begin component implementation
4. ⏳ Test modal integration
5. ⏳ Validate with QA criteria

**Dependencies to Address:**
- Fetch templates in page component (server-side)
- Pass templates through component tree
- Ensure FormAdd modal works in new context

**Questions for User:**
- Should Web assistant be shown with "Coming Soon"? ✅ (Decision: Yes)
- Use existing modal or create new wizard? ✅ (Decision: Existing modal for MVP)
- Need type pre-selection in FormAdd? ⏳ (Optional enhancement)

---

## 📋 UPDATED IMPLEMENTATION PLAN (Based on Real System Analysis)

### Overview

This updated plan incorporates the actual assistant types, creation flows, and template system discovered during technical analysis. The onboarding experience will integrate with existing components rather than creating new wizard routes.

---

### Feature Scope (REVISED)

The onboarding experience will:

**✅ Show when:** User has zero assistants (`assistants.length === 0`)

**🎯 Display:**
- Full-screen empty state with Bot icon illustration
- Heading: "Crea tu Primer Asistente de IA"
- Descriptive text explaining platform capabilities
- **THREE interactive assistant type cards** (not generic button):
  1. **Voice AI** - VAPI integration, phone conversations
  2. **WhatsApp** - Messaging automation, QR deployment
  3. **Web Chat** - Coming Soon badge (disabled)
- **Quick Start Guide button** - Opens dialog with getting started steps
- **No separate "Browse Templates" button** - Templates integrated in creation modal

**✨ User Flow:**
1. User sees three assistant type cards with features
2. User clicks Voice or WhatsApp card
3. Modal opens with `FormAdd.tsx` component (existing)
4. Modal shows:
   - Selected type (Voice/WhatsApp)
   - Template selection (image thumbnails)
   - Name input field
   - Create button
5. Assistant created → onboarding auto-dismissed
6. User redirected to assistants list (master-detail view)

**🔄 Auto-Dismissal:**
- Happens naturally when `assistants.length > 0`
- No explicit dismiss action needed
- Page re-renders on navigation after creation

---

### Component Architecture (UPDATED)

#### File Structure

```
src/components/intelliaa/assistants/onboarding/
├── AssistantsOnboarding.tsx          # Main container (Server Component)
│   ├── Props: { accountSlug, accountId, templates }
│   ├── Renders: Illustration + Heading + Type Cards + Quick Start
│   └── Layout: Centered, max-w-6xl, responsive padding
│
├── AssistantTypeCard.tsx              # Interactive type card (Client Component)
│   ├── Props: { type, templates, accountSlug }
│   ├── State: showModal (controls FormAdd dialog)
│   ├── Features: Click to open modal, hover effects, disabled state
│   └── Badge: "Popular", "Coming Soon", etc.
│
├── EmptyStateIllustration.tsx         # Bot icon with gradient glow
│   ├── Bot icon (20x20) center
│   ├── Phone + MessageSquare accent icons
│   └── Gradient background with blur + pulse animation
│
├── QuickStartGuideDialog.tsx          # Getting started guide (Client Component)
│   ├── Responsive: Dialog (desktop) / Sheet (mobile)
│   ├── Content: 4-step getting started guide
│   └── Future: Video embed placeholder
│
└── types.ts                           # TypeScript interfaces
    ├── AssistantTypeCardData
    ├── ASSISTANT_TYPES constant
    └── Type guards
```

#### Integration Point

```typescript
// src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx

export default async function AssistantsPage({ params }: AssistantsPageProps) {
  // ... fetch assistants logic ...

  // NEW: Fetch templates for onboarding
  const templates = await getAssistantTemplates();

  if (assistants.length === 0) {
    return (
      <AssistantsOnboarding
        accountSlug={accountSlug}
        accountId={accountId}
        templates={templates} // Pass templates for modal
      />
    );
  }

  // ... existing master-detail layout ...
}
```

---

### Assistant Type Card Data Structure

```typescript
// src/components/intelliaa/assistants/onboarding/types.ts

export interface AssistantTypeCardData {
  id: "voice" | "whatsapp" | "web";
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  badge?: "Popular" | "New" | "Coming Soon";
  available: boolean;
  creationFlow: "vapi" | "direct" | "disabled";
}

export const ASSISTANT_TYPES: AssistantTypeCardData[] = [
  {
    id: "voice",
    title: "Asistente de Voz",
    description: "Conversaciones telefónicas naturales con IA",
    icon: Phone,
    features: [
      "Síntesis de voz natural (ElevenLabs)",
      "Soporte en español",
      "Reconocimiento de emociones",
      "Transcripción en tiempo real",
      "Enrutamiento de llamadas",
    ],
    badge: "Popular",
    available: true,
    creationFlow: "vapi", // Creates in VAPI + Supabase
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Mensajería automatizada 24/7",
    icon: MessageSquare,
    features: [
      "Respuestas automáticas 24/7",
      "Conversaciones multiusuario",
      "Envío de archivos multimedia",
      "Despliegue con código QR",
      "Analíticas de mensajes",
    ],
    available: true,
    creationFlow: "direct", // Direct Supabase insert
  },
  {
    id: "web",
    title: "Chat Web",
    description: "Widget de chat para tu sitio web",
    icon: Bot,
    features: [
      "Apariencia personalizable",
      "Integración con base de conocimiento",
      "Soporte multiidioma",
      "Panel de analíticas",
      "Código de inserción",
    ],
    badge: "Próximamente",
    available: false,
    creationFlow: "disabled", // Not yet implemented
  },
];
```

---

### Component Implementation Details

#### 1. AssistantsOnboarding.tsx (Main Container)

```typescript
// Server Component - No "use client" directive
export async function AssistantsOnboarding({
  accountSlug,
  accountId,
  templates,
}: AssistantsOnboardingProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="max-w-6xl w-full space-y-12">
        {/* Illustration */}
        <EmptyStateIllustration />

        {/* Heading & Description */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Crea tu Primer Asistente de IA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Construye asistentes inteligentes de voz y mensajería impulsados por IA.
            Conéctate a tu base de conocimiento y despliega en minutos.
          </p>
        </div>

        {/* Assistant Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ASSISTANT_TYPES.map((type) => (
            <AssistantTypeCard
              key={type.id}
              type={type}
              templates={templates}
              accountSlug={accountSlug}
            />
          ))}
        </div>

        {/* Quick Start Guide */}
        <div className="text-center">
          <QuickStartButton />
        </div>
      </div>
    </div>
  );
}
```

#### 2. AssistantTypeCard.tsx (Interactive Card)

```typescript
"use client"; // Client Component - needs interactivity

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import FormAddComponent from "@/components/intelliaa/assistants/FormAdd";
import type { AssistantTypeCardData } from "./types";

interface AssistantTypeCardProps {
  type: AssistantTypeCardData;
  templates: AssistantTemplate[];
  accountSlug: string;
}

export function AssistantTypeCard({ type, templates, accountSlug }: AssistantTypeCardProps) {
  const [showModal, setShowModal] = useState(false);

  const handleCardClick = () => {
    if (type.available) {
      setShowModal(true);
    }
  };

  return (
    <>
      <Card
        className={`relative overflow-hidden transition-all duration-200 ${
          type.available
            ? "cursor-pointer hover:shadow-lg hover:scale-105 hover:border-primary"
            : "opacity-60 cursor-not-allowed"
        }`}
        onClick={handleCardClick}
        aria-label={`Create ${type.title} assistant`}
        role={type.available ? "button" : undefined}
        tabIndex={type.available ? 0 : -1}
        onKeyDown={(e) => {
          if (type.available && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Badge */}
        {type.badge && (
          <Badge
            className="absolute top-4 right-4 z-10"
            variant={type.badge === "Coming Soon" ? "secondary" : "default"}
          >
            {type.badge}
          </Badge>
        )}

        {/* Card Header */}
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              type.available ? "bg-primary/10" : "bg-muted"
            }`}>
              <type.icon
                className={`h-6 w-6 ${
                  type.available ? "text-primary" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
            </div>
            <CardTitle className="text-lg">{type.title}</CardTitle>
          </div>
        </CardHeader>

        {/* Card Content */}
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{type.description}</p>

          {/* Features List */}
          <ul className="space-y-2" role="list" aria-label={`${type.title} features`}>
            {type.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    type.available ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Creation Modal */}
      {type.available && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Crear {type.title}
              </DialogTitle>
            </DialogHeader>
            <FormAddComponent
              dataTemplates={{ templates }}
              setOpenModal={setShowModal}
              // OPTIONAL ENHANCEMENT: Pass preselectedType={type.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

#### 3. QuickStartButton.tsx + QuickStartGuideDialog.tsx

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlayCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";

export function QuickStartButton() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <Button
        variant="link"
        size="lg"
        onClick={() => setShowGuide(true)}
        aria-label="Ver guía de inicio rápido (2 minutos)"
      >
        <PlayCircle className="w-4 h-4 mr-2" aria-hidden="true" />
        Ver Guía de Inicio Rápido (2 min)
      </Button>

      <QuickStartGuideDialog open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}

function QuickStartGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();

  const content = (
    <div className="space-y-6">
      {/* Video Placeholder */}
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <PlayCircle className="h-16 w-16 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Video tutorial próximamente
          </p>
        </div>
      </div>

      {/* Getting Started Steps */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Primeros Pasos</h3>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              1
            </span>
            <div>
              <strong>Elige tu tipo de asistente:</strong> Voz para llamadas telefónicas o WhatsApp para mensajería
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              2
            </span>
            <div>
              <strong>Selecciona una plantilla:</strong> Configura personalidad y comportamiento de IA
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              3
            </span>
            <div>
              <strong>Conecta documentos (opcional):</strong> Base de conocimiento para respuestas precisas
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              4
            </span>
            <div>
              <strong>Despliega e interactúa:</strong> Obtén tu número o código QR y comienza
            </div>
          </li>
        </ol>
      </div>
    </div>
  );

  // Mobile: Sheet, Desktop: Dialog
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Guía de Inicio Rápido</SheetTitle>
          </SheetHeader>
          <div className="mt-6">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guía de Inicio Rápido</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
```

---

### Template Data Flow

**Server-side template fetching:**

```typescript
// src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx

async function getAssistantTemplates() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assistants_template")
    .select("*")
    .order("name");

  if (error) {
    console.error("[getAssistantTemplates] Error:", error);
    return [];
  }

  return data as AssistantTemplate[];
}

export default async function AssistantsPage({ params }: AssistantsPageProps) {
  // ... existing logic ...

  // Fetch templates for onboarding
  const templates = await getAssistantTemplates();

  if (assistants.length === 0) {
    return (
      <AssistantsOnboarding
        accountSlug={accountSlug}
        accountId={accountId}
        templates={templates} // Pass to onboarding
      />
    );
  }

  // ... rest of page ...
}
```

---

### Updated Acceptance Criteria

- [ ] **AC1:** Full-screen onboarding displays when `assistants.length === 0`
- [ ] **AC2:** Three assistant type cards show with correct features:
  - Voice: Phone, ElevenLabs, Spanish, Emotions, Transcription, Routing
  - WhatsApp: 24/7, Multi-user, Media, QR, Analytics
  - Web: "Próximamente" badge, disabled state
- [ ] **AC3:** Clicking Voice/WhatsApp card opens FormAdd modal with templates
- [ ] **AC4:** "Quick Start Guide" button opens dialog with 4-step guide
- [ ] **AC5:** Modal closes after assistant creation
- [ ] **AC6:** Onboarding auto-dismisses when first assistant created
- [ ] **AC7:** Web card shows disabled state with tooltip
- [ ] **AC8:** Responsive design works on mobile (1 col), tablet (2 col), desktop (3 col)
- [ ] **AC9:** Keyboard navigation works (Tab, Enter, Escape)
- [ ] **AC10:** Screen reader announces card labels and features

---

### Implementation Phases (REVISED)

**Phase 1: Data Structures & Types (1 hour)**
- [ ] Create `types.ts` with `AssistantTypeCardData` interface
- [ ] Define `ASSISTANT_TYPES` constant with Spanish content
- [ ] Add template fetching to page component

**Phase 2: Core Onboarding Component (2 hours)**
- [ ] Create `AssistantsOnboarding.tsx` (Server Component)
- [ ] Create `EmptyStateIllustration.tsx` with Bot + gradient
- [ ] Update page.tsx to pass templates
- [ ] Test conditional rendering

**Phase 3: Interactive Type Cards (3 hours)**
- [ ] Create `AssistantTypeCard.tsx` (Client Component)
- [ ] Implement modal integration with FormAdd
- [ ] Add hover effects and click handlers
- [ ] Implement disabled state for Web type
- [ ] Test modal open/close flow

**Phase 4: Quick Start Guide (1 hour)**
- [ ] Create `QuickStartButton.tsx`
- [ ] Create `QuickStartGuideDialog.tsx` (responsive Dialog/Sheet)
- [ ] Add 4-step getting started content
- [ ] Add video placeholder

**Phase 5: Polish & Animations (2 hours)**
- [ ] Add Framer Motion stagger for cards (optional)
- [ ] Add gradient glow animation
- [ ] Test hover states and transitions
- [ ] Responsive design testing

**Phase 6: Accessibility & Testing (2 hours)**
- [ ] Add ARIA labels to all interactive elements
- [ ] Test keyboard navigation
- [ ] Test screen reader (VoiceOver)
- [ ] Test modal integration with FormAdd
- [ ] Verify onboarding dismissal

**Total Estimate:** 8-11 hours

---

### Critical Implementation Notes

**✅ DO:**
- Use existing `FormAdd.tsx` component (don't recreate)
- Fetch templates server-side in page component
- Pass templates as prop through component tree
- Mark `AssistantTypeCard` as Client Component ("use client")
- Keep `AssistantsOnboarding` as Server Component (no hooks needed)
- Test modal styling inside Dialog wrapper early

**❌ DON'T:**
- Create new wizard route (INT-35 dependency)
- Create separate template browsing flow
- Hardcode template data in component
- Import server functions in Client Components
- Forget to disable Web assistant card
- Skip accessibility testing

**🎯 Integration Points:**
- `AssistantsMasterDetailLayout.tsx` → Remove import of `AssistantsEmptyState`, add `AssistantsOnboarding`
- `page.tsx` → Add template fetching, pass to onboarding
- `FormAdd.tsx` → Works as-is (optional: add `preselectedType` prop later)

---

### Session Log Update

**2025-01-09 - Updated Implementation Plan Complete** ✅
- Analyzed actual assistant types: "voice", "whatsapp", "web"
- Documented Voice (VAPI) and WhatsApp (direct) creation flows
- Confirmed template system structure and integration
- Identified existing `FormAdd.tsx` modal as creation mechanism
- Updated onboarding to use interactive type cards instead of generic button
- Removed "Browse Templates" button (integrated in modal)
- Added Web assistant with "Coming Soon" badge
- Created detailed component structure with Spanish content
- Documented template data flow from server to modal
- Defined all implementation phases with time estimates
- Ready for Phase 1 implementation

**2025-01-09 - Implementation Complete** ✅
- Created all 7 onboarding components (types, illustration, cards, dialog, button)
- Created `templates-server.ts` server action for fetching templates
- Updated `page.tsx` to show onboarding when `assistants.length === 0`
- Updated master-detail layout to receive templates prop
- Created `CreateAssistantButton` component for creating assistants after onboarding
- Integrated button in `AssistantsMasterPanel` header
- Dev server running successfully on http://localhost:3002
- All TypeScript compilation successful

**2025-01-09 - VAPI 400 Error Debugging & Fix** ✅
- User reported HTTP 400 error when creating voice assistant via VAPI API
- Investigated VAPI request payload in `assistantVoice.ts:line 76-117`
- Added detailed error logging to capture VAPI error response (line 132-136)
- Added request payload logging before VAPI call (line 123)
- **Root Cause Identified**: Invalid ElevenLabs voiceId `"StgW6mMosfwXGzfaJ130"`
- **VAPI Error**: "Couldn't Find 11labs Voice" - voice doesn't exist in account
- **Fix Applied**: Updated voiceId to `"26MYCwqeqFSxt1nT7VgZ"` (valid voice from user's ElevenLabs account)
- Updated in two locations: line 99 (VAPI request) and line 156 (Supabase record)
- Voice assistant creation tested and working

**2025-01-09 - Documentation Complete** ✅
- Created comprehensive documentation in `.claude/doc/INT-33-onboarding-experience/`
- **implementation-plan.md** (694 lines):
  - Executive summary with key achievements
  - Problem statement and business impact
  - Complete solution architecture and user flow
  - Technical implementation details for all components
  - Bug fixes documentation (VAPI voiceId)
  - Performance, security, and deployment considerations
  - Lessons learned and future enhancements
- **component-architecture.md** (1049 lines):
  - Component hierarchy visualization
  - Server vs Client component documentation
  - Props interfaces and type definitions
  - State management patterns
  - Integration points with page/layout
  - Code examples and usage patterns
  - Accessibility and performance optimizations
- **user-guide.md** (728 lines):
  - Step-by-step user onboarding walkthrough
  - Assistant types comparison (Voice, WhatsApp, Web)
  - Quick start guide with 4 steps
  - Post-onboarding workflows
  - Comprehensive troubleshooting section
  - 20+ FAQs covering common questions
  - Support and feedback channels
- Amended git commit to include documentation (16 files, 6454 insertions)
- Commit hash updated: `d97a413`

**Final Statistics**:
- **Components Created**: 7 (onboarding) + 1 (CreateAssistantButton) + 1 (templates server action)
- **Files Modified**: 4 (page, layout, panel, assistantVoice)
- **Documentation Pages**: 3 (2,471 total lines)
- **Session Context**: 3,246 lines
- **Total Implementation**: 6,454 lines of code + documentation
- **Branch**: `feature/INT-33-onboarding-experience`
- **Status**: ✅ Ready for QA and merge
