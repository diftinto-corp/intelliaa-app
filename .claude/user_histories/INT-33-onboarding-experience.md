# INT-33: Create Onboarding Experience for First-Time Users

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P1 - Should Have
**Estimate**: 1-2 points (Small)
**Labels**: frontend, ux, onboarding

## User Story

As a new IntelliAA user with no assistants yet, I want to see an engaging onboarding experience that explains assistant types and guides me to create my first assistant, so that I understand the platform's capabilities and can get started quickly.

## Acceptance Criteria

### AC1: Empty State Illustration
**Given** I am a new user with zero assistants
**When** I navigate to the assistants page
**Then** I see a full-screen empty state with an illustration, heading "Create Your First AI Assistant", and descriptive text explaining the value

### AC2: Assistant Type Preview Cards
**Given** I am viewing the onboarding screen
**When** I scroll down or view the content
**Then** I see 3 cards previewing Voice, WhatsApp, and Web assistant types with icons, brief descriptions, and key features

### AC3: Primary CTA Button
**Given** I want to create my first assistant
**When** I click the "Create Assistant" primary button
**Then** I am taken to the step-by-step creation wizard (INT-35)

### AC4: Quick Start Guide Link
**Given** I want to learn more before creating
**When** I click "View Quick Start Guide" secondary link
**Then** a side panel or modal opens with a 2-3 minute video tutorial or interactive walkthrough

### AC5: Skip to Templates Option
**Given** I want to use a pre-built template
**When** I click "Browse Templates" tertiary button
**Then** I am taken directly to the template selection step of the wizard (INT-36)

### AC6: Dismissible Experience
**Given** I have created my first assistant
**When** I return to the assistants page
**Then** the onboarding screen never shows again, and I see the normal master-detail layout

## Technical Notes

### Implementation Details
- **Component**: `AssistantsOnboarding.tsx`
- **File Location**: `src/components/intelliaa/assistants/onboarding/`
- **Conditional Rendering**: Show only when `assistants.length === 0`
- **Dismissal State**: No state needed (naturally dismissed when first assistant created)

### Component Structure
```typescript
// src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx
export function AssistantsOnboarding() {
  const router = useRouter();
  const { accountSlug } = useParams();

  const handleCreateAssistant = () => {
    router.push(`/${accountSlug}/assistants/new`);
  };

  const handleBrowseTemplates = () => {
    router.push(`/${accountSlug}/assistants/new?step=templates`);
  };

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

      <Button variant="link" className="mt-6" onClick={openQuickStartGuide}>
        <PlayCircle className="w-4 h-4 mr-2" />
        View Quick Start Guide (2 min)
      </Button>
    </div>
  );
}
```

### Assistant Type Card Content
```typescript
const ASSISTANT_TYPES = {
  voice: {
    icon: Phone,
    title: 'Voice Assistant',
    description: 'Handle phone calls with natural voice AI',
    features: ['Phone number integration', 'Call recording', 'Transfer rules'],
  },
  whatsapp: {
    icon: MessageSquare,
    title: 'WhatsApp Assistant',
    description: 'Automate WhatsApp conversations at scale',
    features: ['QR code setup', 'Rich media support', 'Multi-language'],
  },
  web: {
    icon: Globe,
    title: 'Web Assistant',
    description: 'Embed AI chat on your website',
    features: ['Custom branding', 'Widget embedding', 'Analytics dashboard'],
  },
} as const;
```

### Illustration Options
- **Option 1**: Use Lucide React icons composed into a custom illustration
- **Option 2**: Integrate illustrations from [unDraw](https://undraw.co/) or [Storyset](https://storyset.com/)
- **Option 3**: Create custom SVG with brand colors
- **Recommendation**: Use Radix UI + Lucide icons for consistency

### Quick Start Guide Implementation
- **Video Option**: Embed Loom/YouTube video in dialog
- **Interactive Option**: Use a library like `react-joyride` for step-by-step tour
- **Documentation Option**: Link to external docs with `target="_blank"`

### Responsive Design
- **Desktop**: Full-width centered layout with 3-column grid
- **Tablet**: 2-column grid for type cards
- **Mobile**: Single column, stacked layout with sticky CTA button

## Definition of Done

- [ ] Onboarding component created with empty state illustration
- [ ] Three assistant type preview cards implemented
- [ ] "Create Assistant" button navigates to wizard
- [ ] "Browse Templates" button navigates to template step
- [ ] Quick Start Guide implemented (video or interactive tour)
- [ ] Component conditionally renders only when zero assistants exist
- [ ] Responsive design verified on mobile, tablet, desktop
- [ ] Accessibility verified (semantic HTML, ARIA labels, keyboard navigation)
- [ ] Integration tested with wizard (INT-35)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-30 (Layout determines when to show onboarding)
- **Integrates with**: INT-35 (Wizard navigation)
- **Integrates with**: INT-36 (Template selection navigation)

## Related Stories

- **Depends on**: INT-30 (Conditional rendering based on assistant count)
- **Links to**: INT-35 (Primary CTA navigates to wizard)
- **Links to**: INT-36 (Templates button navigates to template selection)
- **Enhances**: First-time user experience and activation
