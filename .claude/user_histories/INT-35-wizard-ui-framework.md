# INT-35: Build Multi-Step Wizard UI with Progress Indicator

**Epic**: INT-34 - Step-by-Step Assistant Creation Wizard
**Priority**: P0 - Must Have
**Estimate**: 3-5 points (Medium)
**Labels**: frontend, ui, wizard, forms

## User Story

As an IntelliAA user creating a new assistant, I want to go through a guided step-by-step wizard with clear progress indication, so that I can create a well-configured assistant without feeling overwhelmed by all options at once.

## Acceptance Criteria

### AC1: Step Progress Indicator
**Given** I am in the assistant creation wizard
**When** I view the top of the page
**Then** I see a step indicator showing: 1) Type Selection, 2) Template, 3) Configuration, with current step highlighted and completed steps marked

### AC2: Step Navigation Controls
**Given** I am on step 2 of the wizard
**When** I view the navigation buttons
**Then** I see "Back" and "Next" buttons, with "Next" disabled if current step validation fails

### AC3: Step Validation Blocking
**Given** I am on the Configuration step with invalid assistant name (empty)
**When** I attempt to click "Next"
**Then** the button remains disabled and I see validation error messages below the invalid fields

### AC4: Step State Persistence
**Given** I fill in the Configuration step and go back to Template selection
**When** I change my template choice and proceed forward
**Then** my previously entered configuration is cleared and replaced with the new template's defaults

### AC5: Exit Confirmation Dialog
**Given** I am mid-wizard with unsaved changes
**When** I attempt to navigate away or close the browser tab
**Then** I see a confirmation dialog: "Discard assistant creation?" with Cancel/Discard options

### AC6: Mobile Responsive Wizard
**Given** I access the wizard on mobile
**When** viewing the interface
**Then** the step indicator adapts to a compact vertical layout, and form fields are optimized for touch input

### AC7: Keyboard Navigation
**Given** I am navigating the wizard with keyboard
**When** I press Tab to navigate and Enter on focused buttons
**Then** I can complete the entire wizard flow without using a mouse

## Technical Notes

### Implementation Details
- **Component**: `AssistantWizard.tsx` (main container)
- **File Location**: `src/components/intelliaa/assistants/wizard/`
- **Routing**: `/[accountSlug]/assistants/new?step={stepName}`
- **State Management**: Use `useState` for wizard state, URL params for step tracking

### Wizard Structure
```typescript
// src/components/intelliaa/assistants/wizard/AssistantWizard.tsx
type WizardStep = 'type' | 'template' | 'configuration';

interface WizardState {
  currentStep: WizardStep;
  assistantType?: 'voice' | 'whatsapp' | 'web';
  selectedTemplate?: Template;
  configuration: Partial<AssistantConfig>;
}

const WIZARD_STEPS: { id: WizardStep; label: string; component: React.FC }[] = [
  { id: 'type', label: 'Select Type', component: TypeSelectionStep },
  { id: 'template', label: 'Choose Template', component: TemplateSelectionStep },
  { id: 'configuration', label: 'Configure', component: ConfigurationStep },
];

export function AssistantWizard() {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'type',
    configuration: {},
  });

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === wizardState.currentStep);
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      await createAssistant(wizardState);
    } else {
      setWizardState((prev) => ({
        ...prev,
        currentStep: WIZARD_STEPS[currentStepIndex + 1].id,
      }));
    }
  };

  const handleBack = () => {
    setWizardState((prev) => ({
      ...prev,
      currentStep: WIZARD_STEPS[currentStepIndex - 1].id,
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <WizardProgressIndicator
        steps={WIZARD_STEPS}
        currentStep={wizardState.currentStep}
      />
      <StepContent wizardState={wizardState} onUpdate={setWizardState} />
      <WizardNavigation
        onBack={handleBack}
        onNext={handleNext}
        canGoBack={currentStepIndex > 0}
        canGoNext={isStepValid(wizardState)}
        isLastStep={isLastStep}
      />
    </div>
  );
}
```

### Progress Indicator Component
```typescript
// src/components/intelliaa/assistants/wizard/WizardProgressIndicator.tsx
interface WizardProgressIndicatorProps {
  steps: { id: string; label: string }[];
  currentStep: string;
}

export function WizardProgressIndicator({ steps, currentStep }: WizardProgressIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = steps.findIndex((s) => s.id === currentStep) > index;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isCurrent && 'bg-primary text-primary-foreground',
                    isComplete && 'bg-green-500 text-white',
                    !isCurrent && !isComplete && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isComplete ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <span className="text-sm mt-2 font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-4',
                    isComplete ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

### Navigation Component
```typescript
// src/components/intelliaa/assistants/wizard/WizardNavigation.tsx
interface WizardNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
}

export function WizardNavigation({
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  isLastStep,
}: WizardNavigationProps) {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t">
      <Button variant="outline" onClick={onBack} disabled={!canGoBack}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      <Button onClick={onNext} disabled={!canGoNext}>
        {isLastStep ? 'Create Assistant' : 'Next'}
        {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  );
}
```

### Exit Confirmation Implementation
```typescript
// Use beforeunload event and Next.js router events
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

### Validation Strategy
- Each step component exports a `validate()` function
- Validation runs on blur and before navigation
- Display inline errors using Radix UI Form components
- Aggregate validation in parent wizard component

### Mobile Adaptations
- Progress indicator: Horizontal scrollable on mobile
- Form fields: Full-width with increased touch targets (min 44px height)
- Navigation: Fixed bottom bar on mobile for easy access

## Definition of Done

- [ ] Wizard container component created with step management
- [ ] Progress indicator showing all steps with current/completed states
- [ ] Navigation controls (Back/Next) with proper enabling/disabling
- [ ] Validation blocking implemented for all steps
- [ ] Step state persistence when navigating back/forward
- [ ] Exit confirmation dialog working on navigation away
- [ ] Mobile responsive design verified
- [ ] Keyboard navigation fully functional
- [ ] URL parameters sync with current step
- [ ] Accessibility verified (ARIA labels, focus management, screen reader tested)
- [ ] Integration points ready for step components (INT-36, INT-37, INT-38)
- [ ] Code reviewed and merged

## Dependencies

- None (foundational for wizard flow)
- Will be used by: INT-36, INT-37, INT-38 (step components)

## Related Stories

- **Blocks**: INT-36 (Template Selection Step)
- **Blocks**: INT-37 (Type Selection Step)
- **Blocks**: INT-38 (Configuration Step)
- **Integrates with**: INT-33 (Onboarding CTA navigates here)
