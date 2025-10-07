# INT-36: Create Industry-Specific Template Library and Selection Step

**Epic**: INT-34 - Step-by-Step Assistant Creation Wizard
**Priority**: P0 - Must Have
**Estimate**: 5-8 points (Large)
**Labels**: frontend, backend, templates, ui

## User Story

As an IntelliAA user creating a new assistant, I want to choose from pre-built industry-specific templates with example prompts and configurations, so that I can quickly set up an assistant tailored to my use case without starting from scratch.

## Acceptance Criteria

### AC1: Template Grid Display
**Given** I am on the Template Selection step
**When** the step loads
**Then** I see a grid of 15+ template cards organized by categories (Sales, Support, Healthcare, E-commerce, etc.)

### AC2: Template Card Information
**Given** I view a template card
**When** examining its content
**Then** I see: template name, brief description (2 sentences), industry icon, assistant type compatibility badges, and "Preview" button

### AC3: Template Search and Filter
**Given** I want to find a specific template
**When** I use the search input or category filter
**Then** templates filter in real-time by name, description, or category

### AC4: Template Preview Modal
**Given** I click "Preview" on a template
**When** the modal opens
**Then** I see: full description, example prompt text, recommended settings (temperature, tokens), and sample conversation flow

### AC5: Template Selection
**Given** I choose a template and click "Use Template"
**When** proceeding to Configuration step
**Then** the Configuration form pre-fills with template values (prompt, temperature, tokens, suggested name)

### AC6: Blank Template Option
**Given** I want full control without pre-configuration
**When** I select "Start from Blank" option
**Then** I proceed to Configuration step with empty/default values

### AC7: Template Type Filtering
**Given** I selected "WhatsApp" as assistant type in previous step
**When** viewing templates
**Then** only templates compatible with WhatsApp are displayed (filtered automatically)

## Technical Notes

### Implementation Details
- **Component**: `TemplateSelectionStep.tsx`
- **File Location**: `src/components/intelliaa/assistants/wizard/steps/`
- **Data Source**: `assistants_template` table in Supabase
- **Filtering**: Client-side for <50 templates, server-side for more

### Database Schema
```sql
-- assistants_template table structure
CREATE TABLE assistants_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'sales', 'support', 'healthcare', 'ecommerce', etc.
  industry VARCHAR(50),
  prompt TEXT NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 150,
  top_p DECIMAL(3,2) DEFAULT 1.0,
  frequency_penalty DECIMAL(3,2) DEFAULT 0.0,
  assistant_types TEXT[], -- ['voice', 'whatsapp', 'web']
  sample_conversation JSONB,
  icon_name VARCHAR(50), -- Lucide icon name
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample templates
INSERT INTO assistants_template (name, description, category, prompt, assistant_types) VALUES
  (
    'Customer Support Agent',
    'Helpful assistant for answering customer questions and resolving issues',
    'support',
    'You are a professional customer support agent. Be empathetic, solution-oriented, and always maintain a positive tone. If you cannot resolve an issue, escalate to a human agent.',
    ARRAY['voice', 'whatsapp', 'web']
  ),
  (
    'Sales Qualifier',
    'Qualify leads by asking relevant questions and scheduling appointments',
    'sales',
    'You are a sales qualification assistant. Ask qualifying questions about budget, timeline, and needs. If the lead is qualified (budget >$10k, timeline <3 months), schedule a meeting.',
    ARRAY['voice', 'whatsapp']
  );
```

### Template Card Component
```typescript
// src/components/intelliaa/assistants/wizard/steps/TemplateCard.tsx
interface TemplateCardProps {
  template: Template;
  onSelect: (template: Template) => void;
  onPreview: (template: Template) => void;
}

export function TemplateCard({ template, onSelect, onPreview }: TemplateCardProps) {
  const Icon = LUCIDE_ICONS[template.icon_name] || FileText;

  return (
    <Card className="hover:border-primary transition-all cursor-pointer group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <Icon className="w-8 h-8 text-primary" />
          <div className="flex gap-1">
            {template.assistant_types.map((type) => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        </div>
        <CardTitle className="mt-4">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPreview(template)}>
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
        <Button size="sm" onClick={() => onSelect(template)}>
          Use Template
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Template Preview Modal
```typescript
// src/components/intelliaa/assistants/wizard/steps/TemplatePreviewModal.tsx
export function TemplatePreviewModal({ template, onClose, onUse }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">System Prompt</h4>
            <pre className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
              {template.prompt}
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Recommended Settings</h4>
              <ul className="space-y-1 text-sm">
                <li>Temperature: {template.temperature}</li>
                <li>Max Tokens: {template.max_tokens}</li>
                <li>Top P: {template.top_p}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Compatible Types</h4>
              <div className="flex flex-wrap gap-2">
                {template.assistant_types.map((type) => (
                  <Badge key={type}>{type}</Badge>
                ))}
              </div>
            </div>
          </div>

          {template.sample_conversation && (
            <div>
              <h4 className="font-semibold mb-2">Sample Conversation</h4>
              <SampleConversation messages={template.sample_conversation} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onUse(template)}>
            Use This Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Template Selection Step Component
```typescript
// src/components/intelliaa/assistants/wizard/steps/TemplateSelectionStep.tsx
export function TemplateSelectionStep({ wizardState, onUpdate }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesType = wizardState.assistantType
        ? t.assistant_types.includes(wizardState.assistantType)
        : true;
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      return matchesType && matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory, wizardState.assistantType]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose a Template</h2>
        <p className="text-muted-foreground">
          Start with a pre-built template or create from scratch
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="support">Support</SelectItem>
            <SelectItem value="healthcare">Healthcare</SelectItem>
            <SelectItem value="ecommerce">E-commerce</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          className="border-dashed hover:border-primary cursor-pointer"
          onClick={() => onUpdate({ selectedTemplate: null })}
        >
          <CardHeader className="text-center">
            <PlusCircle className="w-12 h-12 mx-auto text-muted-foreground" />
            <CardTitle className="mt-4">Start from Blank</CardTitle>
            <CardDescription>Create a custom assistant from scratch</CardDescription>
          </CardHeader>
        </Card>

        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={(t) => onUpdate({ selectedTemplate: t })}
            onPreview={(t) => setPreviewTemplate(t)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Initial Template Library (15+ Templates)
Categories to create:
- **Sales**: Lead Qualifier, Appointment Setter, Product Advisor
- **Support**: Customer Service, Technical Support, FAQ Assistant
- **Healthcare**: Appointment Scheduler, Symptom Checker, Patient Follow-up
- **E-commerce**: Order Status, Product Recommendations, Returns Handler
- **Education**: Course Assistant, Tutor, Admissions Helper
- **Real Estate**: Property Inquiry, Tour Scheduler, Lead Qualifier

## Definition of Done

- [ ] Template database table created with RLS policies
- [ ] 15+ industry-specific templates seeded in database
- [ ] Template selection step component created
- [ ] Template grid displays with search and category filters
- [ ] Template cards show all required information
- [ ] Preview modal displays full template details
- [ ] Template selection pre-fills configuration step
- [ ] Blank template option available and functional
- [ ] Type-based filtering works (e.g., WhatsApp templates for WhatsApp assistants)
- [ ] Responsive design verified on all devices
- [ ] Accessibility verified (keyboard navigation, screen readers)
- [ ] Integration tested with wizard framework (INT-35)
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-35 (Wizard UI Framework)
- **Requires**: INT-37 (Type Selection to filter templates)
- **Blocks**: INT-38 (Configuration step receives template data)

## Related Stories

- **Depends on**: INT-35 (Wizard provides step container)
- **Depends on**: INT-37 (Assistant type filters templates)
- **Feeds into**: INT-38 (Template pre-fills configuration)
