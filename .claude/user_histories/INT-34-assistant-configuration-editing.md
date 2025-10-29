# INT-34: Implement Assistant Configuration Editing in Detail Panel

**Epic**: INT-29 - Master-Detail UI and Navigation
**Priority**: P0 - Must Have
**Estimate**: 5-8 points (Large)
**Labels**: frontend, backend, forms, validation, vapi

## User Story

As an IntelliAA user who has created an assistant, I want to edit and configure my assistant's settings from the detail panel, so that I can customize the AI behavior, voice settings, and integrations after initial creation without navigating away from the assistants page.

## Acceptance Criteria

### AC1: Voice Assistant Configuration Form
**Given** I have selected a Voice assistant in the detail panel
**When** I navigate to the "Settings" tab
**Then** I see an editable form with fields for: prompt (textarea), temperature (slider 0-2), max tokens (input), welcome message, end call message, voice selection (dropdown), detect emotion (toggle), background office (toggle), record call (toggle), end call phrases (multi-input)

### AC2: WhatsApp Assistant Configuration Form
**Given** I have selected a WhatsApp assistant in the detail panel
**When** I navigate to the settings section
**Then** I see an editable form with fields for: prompt (textarea), temperature (slider 0-2), max tokens (input), keyword transfer (input), number transfer (input with validation), voice assistant selection (dropdown)

### AC3: Real-Time Form Validation
**Given** I am editing assistant configuration fields
**When** I modify a field value
**Then** validation occurs on blur/change with inline error messages (e.g., "Max tokens must be between 50-4000", "Number transfer must be a valid phone number")

### AC4: Save Changes to Database
**Given** I have modified assistant configuration fields
**When** I click "Guardar" (Save) button
**Then** the changes are persisted to the Supabase `assistants` table, a loading state is shown during save, and a success toast notification appears with "Cambios guardados correctamente"

### AC5: Save Changes to VAPI (Voice Assistants Only)
**Given** I have modified a Voice assistant's configuration
**When** I click "Guardar" button
**Then** the changes are sent to VAPI API via `/api/update-assistant-voice` endpoint, the `voice_assistant_id` record is updated in VAPI, and any errors from VAPI are displayed with retry option

### AC6: Document Storage Assignment
**Given** I am in the "Storages" tab
**When** I view the document storage section
**Then** I can select/unselect document storages to link to the assistant, changes update the `document_storage-assistants` junction table, and linked documents are immediately available for RAG queries

### AC7: Unsaved Changes Warning
**Given** I have modified form fields without saving
**When** I attempt to navigate away (select another assistant or close browser tab)
**Then** I see a confirmation dialog: "¿Descartar cambios sin guardar?" with "Cancelar" and "Descartar" options

### AC8: Form State Management
**Given** I select different assistants
**When** navigating between assistants in the list
**Then** each assistant's form loads with its current saved values, unsaved changes in one assistant don't affect another, and the form resets to saved values when switching

### AC9: Loading States
**Given** the assistant configuration is loading or saving
**When** waiting for the operation to complete
**Then** I see appropriate loading indicators (skeleton on load, disabled form + spinner on save), all interactive elements are disabled during save, and the form re-enables after success/error

### AC10: Type-Specific Field Visibility
**Given** I am viewing assistant configuration
**When** the form loads
**Then** only relevant fields for the assistant type are displayed (Voice-specific fields hidden for WhatsApp and vice versa), tabs adapt to assistant type (e.g., "Embed Code" tab only for Voice)

## Technical Notes

### Implementation Details
- **Voice Component**: `src/components/intelliaa/assistants/voice/TabAssistantVoice.tsx` (already exists)
- **WhatsApp Component**: `src/components/intelliaa/assistants/whatsapp/TabAssistant.tsx` (already exists)
- **Settings Components**:
  - `src/components/intelliaa/assistants/voice/AssistantSettings.tsx`
  - `src/components/intelliaa/assistants/whatsapp/AssistantSettings.tsx`
- **API Routes**:
  - `/api/update-assistant-voice` (POST - updates VAPI + Supabase)
  - Server Actions: `updateAssistant()` in `src/lib/actions/intelliaa/assistants.ts`

### Form State Management
```typescript
// Voice Assistant State
const [temperatureState, setTemperatureState] = useState(assistant?.temperature || 0);
const [maxTokens, setMaxTokens] = useState(assistant.token || 0);
const [promptState, setPromptState] = useState(assistant.prompt || "");
const [welcomeMessage, setWelcomeMessage] = useState(assistant?.welcome_assistant || "");
const [voiceAssistantSelected, setVoiceAssistantSelected] = useState(assistant.voice_assistant || "");
const [detectEmotion, setDetectEmotion] = useState(assistant?.detect_emotion || false);
const [backgroundOffice, setBackgroundOffice] = useState(assistant?.background_office || false);
const [recordCall, setRecordCall] = useState(assistant?.record_call || false);
const [endCallMessage, setEndCallMessage] = useState(assistant?.endCallMessage || "");
const [endCallPhrases, setEndCallPhrases] = useState(assistant?.endCallPhrases || []);
const [voicemailMessage, setVoicemailMessage] = useState(assistant?.voicemailMessage || "");

// WhatsApp Assistant State
const [temperatureState, setTemperatureState] = useState(assistant?.temperature || 0);
const [maxTokens, setMaxTokens] = useState(assistant.token || 0);
const [promptState, setPromptState] = useState(assistant.prompt || "");
const [KeywordTransfer, setKeywordTransfer] = useState(assistant.keyword_transfer_ws || "");
const [NumberTransfer, setNumberTransfer] = useState(assistant.number_transfer_ws || "");
const [voiceAssistantSelected, setVoiceAssistantSelected] = useState(assistant.voice_assistant || "");
```

### Save Handler - Voice Assistant
```typescript
const handleSaveAssistant = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoadingAssistant(true);

  try {
    // Update VAPI via API route
    const res = await fetch("/api/update-assistant-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_assistant: assistant?.id,
        prompt: promptState,
        welcomeMessage: welcomeMessage,
        temperature: temperatureState,
        maxTokens: maxTokens,
        voiceId: voiceAssistantSelected,
        recordCall: recordCall,
        backgroundOffice: backgroundOffice,
        detectEmotion: detectEmotion,
        id_assistant_vapi: assistant?.voice_assistant_id,
        fileIds: selectedDocuments,
        endCallPhrases: endCallPhrases,
        endCallMessage: endCallMessage,
        voicemailMessage: voicemailMessage,
        documentStorageId: documentStorageId,
      }),
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    // Success handling
    toast.success("Cambios guardados correctamente");
  } catch (error) {
    toast.error("Error al guardar cambios");
  } finally {
    setLoadingAssistant(false);
    setIsChangeOptions(false);
  }
};
```

### Save Handler - WhatsApp Assistant
```typescript
const handleSaveAssistant = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoadingAssistant(true);
  const team_account = await getAccountBySlug(null, accountSlug);

  const data = {
    temperature: temperatureState,
    token: maxTokens,
    prompt: promptState,
    keyword_transfer_ws: KeywordTransfer,
    number_transfer_ws: NumberTransfer,
    namespace: assistant.namespace,
    voice_assistant: voiceAssistantSelected,
  };

  // Update Supabase
  await updateAssistant(team_account.account_id, assistant.id, data);

  // Update document storage junction table
  const dsData = await getDsAssistant(assistant.id);
  if (selectedDocumentStorage === "" && dsData.length > 0) {
    await deleteDsAssistant(assistant.id, dsData[0]?.document_storage);
  } else if (dsData.length > 0 && dsData[0].document_storage !== selectedDocumentStorage) {
    await updateDsAssistant(assistant.id, selectedDocumentStorage);
  } else if (dsData.length === 0 && selectedDocumentStorage) {
    await addDsAssistant(assistant.id, selectedDocumentStorage);
  }

  setLoadingAssistant(false);
  setIsChangeOptions(false);
  toast.success("Cambios guardados correctamente");
};
```

### Validation Rules
- **Temperature**: 0.0 - 2.0 (float with 1 decimal)
- **Max Tokens**: 50 - 4000 (integer)
- **Prompt**: Minimum 20 characters, maximum 5000 characters
- **Number Transfer** (WhatsApp): Valid phone format (E.164 recommended)
- **Keyword Transfer**: Optional, max 100 characters
- **End Call Phrases**: Array of strings, max 20 phrases, max 50 chars each

### Document Storage Integration
```typescript
// Fetch document storage assignment
const fetchDsAssistant = async () => {
  const data = await getDsAssistant(assistant.id);
  setDocumentStorageId(data[0]?.document_storage || "");
};

// Component in "Storages" tab
<AssignStorageSection
  assistantId={assistant.id}
  accountId={account_id}
  accountSlug={accountSlug}
/>
```

### Error Handling
- **Network errors**: Show toast with "Error de conexión. Inténtalo de nuevo."
- **VAPI errors**: Parse error message and show specific issue (e.g., "Voice ID not found")
- **Validation errors**: Inline field-level errors with red border and message below
- **Concurrent edits**: Use optimistic locking or timestamp comparison

### Accessibility
- All form fields have proper `<label>` elements or `aria-label`
- Error messages announced via `aria-live="polite"`
- Focus management: first error field receives focus on validation failure
- Keyboard navigation: Tab through all fields, Enter to submit
- Screen reader support: Form state changes announced

## Definition of Done

- [ ] Voice assistant configuration form implemented and functional
- [ ] WhatsApp assistant configuration form implemented and functional
- [ ] All form fields validate correctly with inline error messages
- [ ] Save changes persist to Supabase `assistants` table
- [ ] Voice assistant changes sync to VAPI via API route
- [ ] Document storage assignment working via junction table
- [ ] Unsaved changes warning dialog implemented
- [ ] Form state resets correctly when switching assistants
- [ ] Loading states (skeleton, spinner, disabled) implemented
- [ ] Type-specific fields show/hide correctly
- [ ] Error handling for all failure scenarios
- [ ] Toast notifications for success/error states
- [ ] Accessibility verified (keyboard nav, screen readers, ARIA)
- [ ] Mobile responsive design tested
- [ ] Integration tested with VAPI API
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-30 (Master-Detail Layout - provides detail panel)
- **Existing**:
  - `TabAssistantVoice.tsx` and `TabAssistant.tsx` components
  - `/api/update-assistant-voice` API route
  - `updateAssistant()` server action
  - Document storage components
  - VAPI service integration

## Related Stories

- **Depends on**: INT-30 (Detail panel structure)
- **Related**: INT-32 (Status updates after save)
- **Related**: INTEL-008, INTEL-009 (Document storage assignment)
- **Enhances**: Current assistant editing flow with better UX
