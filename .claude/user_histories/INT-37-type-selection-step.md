# INT-37: Implement Assistant Type Selection Step

**Epic**: INT-34 - Step-by-Step Assistant Creation Wizard
**Priority**: P0 - Must Have
**Estimate**: 1-2 points (Small)
**Labels**: frontend, ui, wizard

## User Story

As an IntelliAA user starting to create an assistant, I want to select the type of assistant (Voice, WhatsApp, or Web) as my first step, so that the wizard can provide type-specific templates and configuration options.

## Acceptance Criteria

### AC1: Type Selection Cards Display
**Given** I am on the first step of the wizard
**When** the page loads
**Then** I see three large selection cards for Voice, WhatsApp, and Web assistants with icons and descriptions

### AC2: Type Card Features List
**Given** I view each assistant type card
**When** examining the content
**Then** I see: type name, icon, brief description, and 3-4 key features specific to that type

### AC3: Single Selection Interaction
**Given** I click on the "Voice" assistant card
**When** the selection occurs
**Then** the Voice card highlights with primary border/background, other cards dim, and "Next" button enables

### AC4: Type Information Tooltip
**Given** I hover over the info icon on a type card
**When** the tooltip appears
**Then** I see expanded information about use cases and requirements for that assistant type

### AC5: Type Selection Persistence
**Given** I select "WhatsApp" and proceed to next step
**When** I navigate back to Type Selection
**Then** WhatsApp remains selected/highlighted

### AC6: Type Change Warning
**Given** I selected "Voice" and configured templates, then go back to change type
**When** I select a different type
**Then** I see a warning: "Changing type will reset your configuration. Continue?"

## Technical Notes

### Implementation Details
- **Component**: `TypeSelectionStep.tsx`
- **File Location**: `src/components/intelliaa/assistants/wizard/steps/`
- **State**: Updates `wizardState.assistantType`

### Type Configuration
```typescript
const ASSISTANT_TYPES = {
  voice: {
    id: 'voice',
    name: 'Voice Assistant',
    icon: Phone,
    description: 'AI-powered phone conversations with natural voice',
    features: [
      'Phone number integration',
      'Call recording & transcription',
      'Intelligent call transfer rules',
      'Real-time voice synthesis',
    ],
    requirements: 'Requires: VAPI integration, Twilio phone number',
    color: 'blue',
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Assistant',
    icon: MessageSquare,
    description: 'Automated WhatsApp conversations at scale',
    features: [
      'QR code instant setup',
      'Rich media support (images, audio, docs)',
      'Multi-language conversations',
      'Broadcast & group messaging',
    ],
    requirements: 'Requires: WhatsApp Business account, Evolution API',
    color: 'green',
  },
  web: {
    id: 'web',
    name: 'Web Chat Assistant',
    icon: Globe,
    description: 'Embeddable AI chat widget for your website',
    features: [
      'Custom branding & styling',
      'Easy widget embedding',
      'Conversation analytics',
      'GDPR compliant',
    ],
    requirements: 'Requires: Website with JavaScript support',
    color: 'purple',
  },
} as const;
```

### Component Implementation
```typescript
// src/components/intelliaa/assistants/wizard/steps/TypeSelectionStep.tsx
export function TypeSelectionStep({ wizardState, onUpdate }) {
  const handleTypeSelect = (type: AssistantType) => {
    if (wizardState.assistantType && wizardState.assistantType !== type) {
      // Show confirmation dialog
      setConfirmDialog({
        type,
        message: 'Changing assistant type will reset your configuration. Continue?',
      });
    } else {
      onUpdate({ assistantType: type });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Select Assistant Type</h2>
        <p className="text-muted-foreground">
          Choose the channel where your AI assistant will interact with users
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(ASSISTANT_TYPES).map((type) => (
          <TypeCard
            key={type.id}
            type={type}
            isSelected={wizardState.assistantType === type.id}
            onSelect={handleTypeSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TypeCard({ type, isSelected, onSelect }) {
  const Icon = type.icon;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg',
        isSelected && 'border-primary border-2 bg-primary/5',
        !isSelected && 'opacity-70 hover:opacity-100'
      )}
      onClick={() => onSelect(type.id)}
    >
      <CardHeader>
        <Icon className={cn('w-12 h-12', `text-${type.color}-500`)} />
        <CardTitle className="flex items-center gap-2 mt-4">
          {type.name}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{type.requirements}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>{type.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {type.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-primary mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

### Validation
```typescript
// Validate that type is selected before allowing next step
export function validateTypeSelection(wizardState: WizardState): boolean {
  return !!wizardState.assistantType;
}
```

## Definition of Done

- [ ] Type selection step component created
- [ ] Three type cards displayed with all information
- [ ] Single selection interaction working
- [ ] Info tooltips display requirements
- [ ] Selection persists when navigating back
- [ ] Change type warning dialog implemented
- [ ] Validation prevents proceeding without selection
- [ ] Responsive design verified
- [ ] Accessibility verified (keyboard selection, ARIA labels)
- [ ] Integration tested with wizard framework (INT-35)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-35 (Wizard UI Framework)
- **Blocks**: INT-36 (Type filters available templates)

## Related Stories

- **Depends on**: INT-35 (Wizard provides step container)
- **Feeds into**: INT-36 (Type selection filters templates)
- **Links to**: INT-33 (Onboarding type cards should match)
