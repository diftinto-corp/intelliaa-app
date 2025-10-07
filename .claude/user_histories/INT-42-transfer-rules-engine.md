# INT-42: Implement Intelligent Call Transfer Rules Engine

**Epic**: INT-39 - Voice Assistant VAPI Integration Modernization
**Priority**: P1 - Should Have
**Estimate**: 5-8 points (Large)
**Labels**: backend, frontend, voice, transfer-rules

## User Story

As an IntelliAA user managing voice assistants, I want to configure intelligent call transfer rules based on keywords, intent, sentiment, and business hours, so that calls are automatically routed to the right department or escalated to humans when needed.

## Acceptance Criteria

### AC1: Transfer Rule Creation UI
**Given** I am configuring voice assistant transfer settings
**When** I access the Transfer Rules tab
**Then** I can create rules with conditions (keyword match, intent detection, sentiment threshold, business hours) and actions (transfer to number, end call, voicemail)

### AC2: Keyword-Based Transfer
**Given** I configure a rule: "If caller says 'billing' → transfer to +1234567890"
**When** a caller mentions "billing" during conversation
**Then** the call transfers to the specified number within 3 seconds with transfer message

### AC3: Intent-Based Transfer
**Given** I configure: "If intent is 'technical_support' → transfer to tech team"
**When** VAPI detects technical support intent
**Then** call routes to technical support number with context

### AC4: Sentiment-Based Escalation
**Given** I configure: "If sentiment < -0.5 (negative) → escalate to manager"
**When** conversation sentiment drops below threshold
**Then** system escalates to manager queue with conversation summary

### AC5: Business Hours Handling
**Given** I configure business hours (Mon-Fri 9am-5pm EST)
**When** a call arrives at 7pm
**Then** voicemail message plays instead of attempting transfer

### AC6: Transfer Analytics
**Given** transfer rules are active
**When** viewing analytics dashboard
**Then** I see: total transfers, transfers by rule, success/fail rates, average transfer time

### AC7: Rule Priority and Ordering
**Given** multiple rules match simultaneously
**When** evaluating transfer conditions
**Then** rules execute in priority order (user-defined drag-and-drop ordering)

## Technical Notes

### Transfer Rules Schema
```typescript
interface TransferRule {
  id: string;
  assistant_id: string;
  name: string;
  priority: number; // Lower = higher priority
  enabled: boolean;
  conditions: TransferCondition[];
  actions: TransferAction[];
}

interface TransferCondition {
  type: 'keyword' | 'intent' | 'sentiment' | 'business_hours' | 'call_duration';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: string | number;
  case_sensitive?: boolean;
}

interface TransferAction {
  type: 'transfer' | 'voicemail' | 'end_call' | 'custom_message';
  transfer_number?: string;
  message?: string;
  department?: string;
}

// Database table
CREATE TABLE transfer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100),
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### VAPI Function Calling Integration
```typescript
// Register custom function with VAPI
export async function registerTransferFunction(assistantId: string) {
  const vapiConfig = {
    functions: [
      {
        name: 'evaluate_transfer_rules',
        description: 'Evaluate if call should be transferred based on conversation context',
        parameters: {
          type: 'object',
          properties: {
            transcript: { type: 'string' },
            detected_intent: { type: 'string' },
            sentiment_score: { type: 'number' },
          },
        },
        async: true,
      },
    ],
  };

  await vapiClient.assistants.update(assistantId, vapiConfig);
}

// Webhook handler for function execution
export async function handleTransferEvaluation(request: TransferRequest) {
  const { assistant_id, transcript, detected_intent, sentiment_score } = request;

  // Get transfer rules
  const rules = await getTransferRules(assistant_id);

  // Evaluate rules in priority order
  for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
    if (!rule.enabled) continue;

    const conditionsMet = evaluateConditions(rule.conditions, {
      transcript,
      detected_intent,
      sentiment_score,
      current_time: new Date(),
    });

    if (conditionsMet) {
      return executeAction(rule.actions[0]);
    }
  }

  return { transfer: false };
}
```

### Transfer Rules UI Component
```typescript
// src/components/intelliaa/assistants/voice/TransferRulesManager.tsx
export function TransferRulesManager({ assistantId }) {
  const [rules, setRules] = useState<TransferRule[]>([]);
  const [editingRule, setEditingRule] = useState<TransferRule | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Transfer Rules</h2>
        <Button onClick={() => setEditingRule(createEmptyRule())}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <DragDropContext onDragEnd={handleReorder}>
        <Droppable droppableId="rules">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {rules.map((rule, index) => (
                <Draggable key={rule.id} draggableId={rule.id} index={index}>
                  {(provided) => (
                    <TransferRuleCard
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      rule={rule}
                      onEdit={setEditingRule}
                      onToggle={toggleRule}
                      onDelete={deleteRule}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {editingRule && (
        <TransferRuleEditor
          rule={editingRule}
          onSave={saveRule}
          onCancel={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
```

### Business Hours Configuration
```typescript
interface BusinessHours {
  timezone: string; // e.g., 'America/New_York'
  schedule: {
    [day: string]: { open: string; close: string } | null;
  };
}

function isWithinBusinessHours(hours: BusinessHours): boolean {
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: hours.timezone }));
  const day = userTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  if (!hours.schedule[day]) return false;

  const { open, close } = hours.schedule[day];
  const currentTime = userTime.toLocaleTimeString('en-US', { hour12: false });

  return currentTime >= open && currentTime <= close;
}
```

## Definition of Done

- [ ] Transfer rules database table created with RLS
- [ ] Transfer rules UI created with drag-and-drop ordering
- [ ] Keyword-based transfer rules working
- [ ] Intent-based transfer rules working
- [ ] Sentiment-based transfer rules working
- [ ] Business hours configuration implemented
- [ ] VAPI function calling integration complete
- [ ] Webhook handler for rule evaluation deployed
- [ ] Transfer analytics dashboard created
- [ ] Rule priority system functional
- [ ] Testing completed with live VAPI calls
- [ ] Documentation created for rule configuration
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-40 (VAPI v2 with function calling)
- VAPI webhook infrastructure
- Phone numbers for transfer testing

## Related Stories

- **Depends on**: INT-40 (VAPI v2 API)
- **Related**: Voice assistant configuration
- **Enhances**: Customer support workflows
