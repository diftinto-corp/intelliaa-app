# INT-38: Build Configuration Step with Real-Time Validation

**Epic**: INT-34 - Step-by-Step Assistant Creation Wizard
**Priority**: P0 - Must Have
**Estimate**: 5-8 points (Large)
**Labels**: frontend, validation, forms

## User Story

As an IntelliAA user configuring my new assistant, I want real-time validation and pre-filled values from my selected template, so that I can quickly create a properly configured assistant with confidence.

## Acceptance Criteria

### AC1: Template Pre-filled Values
**Given** I selected a template in the previous step
**When** the Configuration step loads
**Then** all fields are pre-filled with template values (name suggestion, prompt, temperature, tokens)

### AC2: Assistant Name Uniqueness Check
**Given** I enter an assistant name
**When** I blur the name input field
**Then** system checks uniqueness within my account and shows error if name exists (debounced 500ms)

### AC3: Prompt Text Area with Variables
**Given** I am editing the system prompt
**When** I type in the prompt textarea
**Then** I can use {{variables}} syntax with autocomplete suggestions ({{user_name}}, {{company}}, etc.)

### AC4: Temperature Slider Validation
**Given** I adjust the temperature slider
**When** moving the slider
**Then** I see real-time value display (0.0-2.0) with description of behavior at current value

### AC5: Token Limit Warning
**Given** I set max tokens to 4000
**When** the value exceeds recommended limit for selected model
**Then** I see a warning: "High token count may increase costs and latency"

### AC6: Document Storage Selection
**Given** I want to attach knowledge base documents
**When** I open the document storage selector
**Then** I see a list of my existing document stores with preview of content count

### AC7: Form Validation Summary
**Given** I have multiple validation errors
**When** I attempt to submit
**Then** I see a summary of all errors at the top of the form with jump links to each field

## Technical Notes

### Configuration Form Schema
```typescript
interface AssistantConfiguration {
  name: string; // Required, unique per account, 3-50 chars
  prompt: string; // Required, min 20 chars
  temperature: number; // 0.0 - 2.0, default 0.7
  max_tokens: number; // 50 - 4000, default 150
  top_p: number; // 0.0 - 1.0, default 1.0
  frequency_penalty: number; // 0.0 - 2.0, default 0.0
  document_storage_ids: string[]; // Optional, array of UUIDs
  // Type-specific fields
  voice_id?: string; // For voice assistants
  whatsapp_number?: string; // For WhatsApp assistants
}

const configSchema = z.object({
  name: z.string().min(3).max(50).refine(async (name) => {
    const exists = await checkNameUniqueness(name);
    return !exists;
  }, "Assistant name already exists"),
  prompt: z.string().min(20, "Prompt must be at least 20 characters"),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(50).max(4000),
  // ... other fields
});
```

### Component Structure
```typescript
// src/components/intelliaa/assistants/wizard/steps/ConfigurationStep.tsx
export function ConfigurationStep({ wizardState, onUpdate }) {
  const form = useForm<AssistantConfiguration>({
    resolver: zodResolver(configSchema),
    defaultValues: wizardState.selectedTemplate
      ? templateToConfiguration(wizardState.selectedTemplate)
      : DEFAULT_CONFIGURATION,
  });

  const [nameChecking, setNameChecking] = useState(false);

  const checkNameUniqueness = useDebouncedCallback(async (name: string) => {
    setNameChecking(true);
    const exists = await checkAssistantNameExists(name, accountId);
    if (exists) {
      form.setError('name', { message: 'Assistant name already exists' });
    }
    setNameChecking(false);
  }, 500);

  return (
    <Form {...form}>
      <div className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assistant Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Customer Support Bot"
                  onBlur={(e) => checkNameUniqueness(e.target.value)}
                />
              </FormControl>
              {nameChecking && <FormDescription>Checking availability...</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt</FormLabel>
              <FormControl>
                <PromptTextArea {...field} />
              </FormControl>
              <FormDescription>
                Define your assistant's behavior. Use {{variable}} for dynamic values.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperature: {field.value}</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={[field.value]}
                    onValueChange={([value]) => field.onChange(value)}
                  />
                </FormControl>
                <FormDescription>
                  {getTemperatureDescription(field.value)}
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_tokens"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Tokens</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                {field.value > 2000 && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      High token count may increase costs and latency
                    </AlertDescription>
                  </Alert>
                )}
              </FormItem>
            )}
          />
        </div>

        <DocumentStorageSelector
          selectedIds={form.watch('document_storage_ids')}
          onChange={(ids) => form.setValue('document_storage_ids', ids)}
        />
      </div>
    </Form>
  );
}
```

### Prompt Variable Autocomplete
```typescript
const AVAILABLE_VARIABLES = [
  { key: '{{user_name}}', description: 'Customer/caller name' },
  { key: '{{company}}', description: 'Your company name' },
  { key: '{{current_date}}', description: 'Current date' },
  { key: '{{current_time}}', description: 'Current time' },
];

// Implement autocomplete with @mention-style UI
```

## Definition of Done

- [ ] Configuration form created with all required fields
- [ ] Template values pre-fill form on step load
- [ ] Name uniqueness validation working with debounce
- [ ] Prompt textarea with variable autocomplete
- [ ] Temperature slider with real-time descriptions
- [ ] Token limit warnings display correctly
- [ ] Document storage selector integrated
- [ ] Form validation summary shows all errors
- [ ] Type-specific fields show/hide based on assistant type
- [ ] All validations working (client and server-side)
- [ ] Form state persists when navigating back
- [ ] Accessibility verified (error announcements, field labels)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-35 (Wizard framework)
- **Requires**: INT-36 (Template provides default values)
- API: `/api/assistants/check-name` for uniqueness check

## Related Stories

- **Depends on**: INT-35, INT-36, INT-37
- **Completes**: Assistant creation flow
