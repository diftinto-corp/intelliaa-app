# INT-33: Component Architecture Documentation

**Feature**: Onboarding Experience Components
**Status**: ✅ Implemented
**Last Updated**: 2025-01-09

---

## Table of Contents

1. [Component Hierarchy](#component-hierarchy)
2. [Server Components](#server-components)
3. [Client Components](#client-components)
4. [Shared Types](#shared-types)
5. [Props Documentation](#props-documentation)
6. [State Management](#state-management)
7. [Integration Points](#integration-points)
8. [Code Examples](#code-examples)

---

## Component Hierarchy

```
Page (Server)
└── assistants.length === 0 ?
    ├── AssistantsOnboarding (Server)
    │   ├── EmptyStateIllustration (Server)
    │   ├── Heading + Description (Static)
    │   ├── Grid of AssistantTypeCard[] (Client)
    │   │   └── AssistantTypeCard (Client)
    │   │       └── Dialog
    │   │           └── FormAdd (Client)
    │   └── QuickStartButton (Client)
    │       └── QuickStartGuideDialog (Client)
    │           └── Responsive: Dialog | Sheet
    :
    └── AssistantsMasterDetailLayout (Client)
        ├── AssistantsMasterPanel (Client)
        │   ├── Header with count
        │   ├── CreateAssistantButton (Client)
        │   │   └── Dialog
        │   │       └── FormAdd (Client)
        │   └── Assistant List
        └── AssistantsDetailPanel (Client)
```

---

## Server Components

### AssistantsOnboarding

**Location**: `src/components/intelliaa/assistants/onboarding/AssistantsOnboarding.tsx`

**Purpose**: Main container for the onboarding experience displayed when users have zero assistants.

**Component Type**: Server Component (no "use client" directive)

#### Props Interface

```typescript
interface AssistantsOnboardingProps {
  accountSlug: string;  // For routing context
  accountId: string;    // Database account identifier
  templates: AssistantTemplate[];  // Available assistant templates
}
```

#### Responsibilities

1. **Layout Management**: Full-screen centered layout with gradient background
2. **Content Structure**: Organizes illustration, heading, cards, and quick start
3. **Template Distribution**: Passes templates to child components
4. **Static Rendering**: No client-side state, fully server-rendered

#### Structure

```tsx
<div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-muted/20">
  <div className="max-w-6xl w-full space-y-12 animate-in fade-in duration-500">
    {/* 1. Visual Empty State */}
    <EmptyStateIllustration />

    {/* 2. Hero Section */}
    <div className="text-center space-y-4">
      <h1>Crea tu Primer Asistente de IA</h1>
      <p>Construye asistentes inteligentes...</p>
    </div>

    {/* 3. Type Cards Grid */}
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

    {/* 4. Quick Start CTA */}
    <div className="text-center">
      <QuickStartButton />
    </div>
  </div>
</div>
```

#### Styling Classes

- `min-h-screen` - Full viewport height
- `bg-gradient-to-b from-background to-muted/20` - Subtle gradient
- `max-w-6xl` - Maximum container width (1152px)
- `animate-in fade-in duration-500` - Smooth entrance animation

#### Usage Example

```tsx
// In page.tsx
if (assistants.length === 0) {
  return (
    <AssistantsOnboarding
      accountSlug={accountSlug}
      accountId={accountId}
      templates={templates}
    />
  );
}
```

---

### EmptyStateIllustration

**Location**: `src/components/intelliaa/assistants/onboarding/EmptyStateIllustration.tsx`

**Purpose**: Animated visual element for empty state, featuring a bot icon with gradient glow.

**Component Type**: Server Component

#### Props Interface

```typescript
// No props - fully self-contained
export function EmptyStateIllustration() { ... }
```

#### Responsibilities

1. **Visual Appeal**: Eye-catching animated illustration
2. **Brand Consistency**: Uses primary/accent color scheme
3. **Animation**: Pulse effect on glow background
4. **Scalability**: Responsive sizing for mobile/desktop

#### Structure

```tsx
<div className="flex justify-center">
  <div className="relative">
    {/* Animated Glow Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 rounded-full blur-3xl animate-pulse" />

    {/* Main Icon Container */}
    <div className="relative bg-gradient-to-br from-primary to-accent p-8 rounded-3xl shadow-2xl">
      <Bot className="h-20 w-20 text-primary-foreground" />
    </div>

    {/* Accent Icons */}
    <div className="absolute -top-2 -right-2 bg-background border-2 border-primary/20 p-3 rounded-xl shadow-lg">
      <Phone className="h-6 w-6 text-primary" />
    </div>
    <div className="absolute -bottom-2 -left-2 bg-background border-2 border-accent/20 p-3 rounded-xl shadow-lg">
      <MessageSquare className="h-6 w-6 text-accent" />
    </div>
    <div className="absolute top-1/2 -right-6 bg-background border-2 border-primary/20 p-2 rounded-lg shadow-lg">
      <Sparkles className="h-5 w-5 text-primary" />
    </div>
  </div>
</div>
```

#### Styling Details

**Glow Effect**:
- `bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30` - Multi-stop gradient
- `blur-3xl` - Heavy blur for soft glow
- `animate-pulse` - Breathing animation

**Main Container**:
- `bg-gradient-to-br from-primary to-accent` - Diagonal gradient
- `rounded-3xl` - Smooth corners (24px)
- `shadow-2xl` - Deep shadow for depth

**Accent Icons**:
- `absolute positioning` - Floating around main icon
- `bg-background` - Matches theme background
- `border-2 border-primary/20` - Subtle colored border
- `shadow-lg` - Elevation effect

---

## Client Components

### AssistantTypeCard

**Location**: `src/components/intelliaa/assistants/onboarding/AssistantTypeCard.tsx`

**Purpose**: Interactive card representing an assistant type (Voice, WhatsApp, Web) with click-to-create functionality.

**Component Type**: Client Component

#### Props Interface

```typescript
interface AssistantTypeCardProps {
  type: AssistantTypeCardData;        // Card configuration
  templates: AssistantTemplate[];     // Available templates
  accountSlug: string;                // For routing
}

interface AssistantTypeCardData {
  id: "voice" | "whatsapp" | "web";
  title: string;                      // "Asistente de Voz"
  description: string;                // Short description
  icon: LucideIcon;                   // Phone, MessageSquare, etc.
  features: string[];                 // Bullet point features
  badge?: "Popular" | "New" | "Próximamente";
  available: boolean;                 // Enabled/disabled state
  creationFlow: "vapi" | "direct" | "disabled";
}
```

#### State Management

```typescript
const [showModal, setShowModal] = useState(false);
```

**State Purpose**: Controls Dialog visibility for FormAdd modal.

#### Responsibilities

1. **Visual Card**: Display assistant type with icon, badge, and features
2. **Interaction**: Handle click to open creation modal
3. **Disabled State**: Show "Coming Soon" for unavailable types
4. **Modal Integration**: Wrap FormAdd in Dialog component

#### Structure

```tsx
<>
  {/* Card */}
  <Card
    className={`relative overflow-hidden transition-all duration-300 ${
      type.available
        ? "cursor-pointer hover:scale-105 hover:shadow-xl"
        : "opacity-60 cursor-not-allowed"
    }`}
    onClick={handleCardClick}
  >
    {/* Badge */}
    {type.badge && (
      <Badge variant={getBadgeVariant(type.badge)}>
        {type.badge}
      </Badge>
    )}

    {/* Icon */}
    <div className="flex justify-center mb-4">
      <div className="p-4 bg-primary/10 rounded-full">
        <Icon className="h-10 w-10 text-primary" />
      </div>
    </div>

    {/* Title & Description */}
    <CardHeader>
      <CardTitle>{type.title}</CardTitle>
      <CardDescription>{type.description}</CardDescription>
    </CardHeader>

    {/* Features List */}
    <CardContent>
      <ul className="space-y-2">
        {type.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </CardContent>

    {/* CTA Footer */}
    <CardFooter>
      <p className="text-xs text-muted-foreground">
        {type.available
          ? "Haz clic para crear →"
          : "Próximamente disponible"}
      </p>
    </CardFooter>
  </Card>

  {/* Creation Modal */}
  <Dialog open={showModal} onOpenChange={setShowModal}>
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary" />
          Crear {type.title}
        </DialogTitle>
      </DialogHeader>
      <FormAddComponent
        dataTemplates={{ templates }}
        setOpenModal={setShowModal}
      />
    </DialogContent>
  </Dialog>
</>
```

#### Interaction Handlers

```typescript
const handleCardClick = () => {
  if (type.available) {
    setShowModal(true);
  }
};

const getBadgeVariant = (badge: string) => {
  switch (badge) {
    case "Popular":
      return "default";
    case "New":
      return "secondary";
    case "Próximamente":
      return "outline";
    default:
      return "default";
  }
};
```

#### Styling States

**Available (Interactive)**:
```css
cursor-pointer
hover:scale-105
hover:shadow-xl
transition-all duration-300
```

**Disabled (Read-only)**:
```css
opacity-60
cursor-not-allowed
```

---

### CreateAssistantButton

**Location**: `src/components/intelliaa/assistants/CreateAssistantButton.tsx`

**Purpose**: Reusable button component for creating assistants after onboarding (post-first-assistant).

**Component Type**: Client Component

#### Props Interface

```typescript
interface CreateAssistantButtonProps {
  templates: AssistantTemplate[];
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}
```

#### State Management

```typescript
const [showModal, setShowModal] = useState(false);
```

#### Responsibilities

1. **Accessible CTA**: Clear button for creating new assistants
2. **Modal Trigger**: Opens FormAdd dialog on click
3. **Reusability**: Can be used in multiple locations with different variants
4. **Icon + Text**: Visual Plus icon with "Crear Asistente" label

#### Usage in AssistantsMasterPanel

```tsx
<div className="p-4 border-b space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="font-semibold text-lg">Asistentes</h2>
      <p className="text-sm text-muted-foreground">
        {assistants.length} {assistants.length === 1 ? "asistente" : "asistentes"}
      </p>
    </div>
  </div>

  {/* Create Button */}
  <CreateAssistantButton templates={templates} className="w-full" />
</div>
```

#### Structure

```tsx
<>
  <Button
    variant={variant}
    size={size}
    className={className}
    onClick={() => setShowModal(true)}
  >
    <Plus className="h-4 w-4 mr-2" />
    Crear Asistente
  </Button>

  <Dialog open={showModal} onOpenChange={setShowModal}>
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Crear Nuevo Asistente</DialogTitle>
      </DialogHeader>
      <FormAddComponent
        dataTemplates={{ templates }}
        setOpenModal={setShowModal}
      />
    </DialogContent>
  </Dialog>
</>
```

#### Variants

```tsx
// Default (Primary Button)
<CreateAssistantButton templates={templates} />

// Outline (Secondary Style)
<CreateAssistantButton templates={templates} variant="outline" />

// Small Size
<CreateAssistantButton templates={templates} size="sm" />

// Custom Styling
<CreateAssistantButton
  templates={templates}
  className="w-full bg-gradient-to-r from-primary to-accent"
/>
```

---

### QuickStartButton

**Location**: `src/components/intelliaa/assistants/onboarding/QuickStartButton.tsx`

**Purpose**: Opens quick start guide dialog with 4-step tutorial.

**Component Type**: Client Component

#### Props Interface

```typescript
// No props - self-contained with internal state
export function QuickStartButton() { ... }
```

#### State Management

```typescript
const [open, setOpen] = useState(false);
```

#### Structure

```tsx
<>
  <Button
    variant="outline"
    size="lg"
    onClick={() => setOpen(true)}
    className="gap-2"
  >
    <Lightbulb className="h-5 w-5" />
    Ver Guía Rápida
  </Button>

  <QuickStartGuideDialog open={open} onOpenChange={setOpen} />
</>
```

---

### QuickStartGuideDialog

**Location**: `src/components/intelliaa/assistants/onboarding/QuickStartGuideDialog.tsx`

**Purpose**: Educational modal with 4-step getting started guide, responsive (Dialog/Sheet).

**Component Type**: Client Component

#### Props Interface

```typescript
interface QuickStartGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

#### Responsive Behavior

```typescript
const isMobile = useIsMobile(); // Custom hook: (max-width: 768px)

return isMobile ? (
  <Sheet open={open} onOpenChange={onOpenChange}>
    {/* Sheet Content */}
  </Sheet>
) : (
  <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Dialog Content */}
  </Dialog>
);
```

#### Steps Content

```typescript
const steps = [
  {
    icon: Sparkles,
    title: "Elige tu tipo de asistente",
    description: "Selecciona entre asistente de Voz para llamadas telefónicas o WhatsApp para mensajería automatizada.",
  },
  {
    icon: Wrench,
    title: "Configura con plantilla",
    description: "Escoge una plantilla prediseñada optimizada para atención al cliente, ventas, soporte técnico o personaliza una desde cero.",
  },
  {
    icon: BookOpen,
    title: "Sube documentos de conocimiento",
    description: "Carga PDFs, manuales o documentación para que tu asistente responda con información específica de tu negocio.",
  },
  {
    icon: Rocket,
    title: "Prueba y despliega",
    description: "Realiza pruebas de conversación, ajusta respuestas y despliega tu asistente en producción cuando esté listo.",
  },
];
```

#### Mobile Layout (Sheet)

```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="bottom" className="h-[80vh]">
    <SheetHeader>
      <SheetTitle>Guía Rápida de Inicio</SheetTitle>
      <SheetDescription>
        Sigue estos pasos para crear tu primer asistente de IA
      </SheetDescription>
    </SheetHeader>

    <ScrollArea className="h-[calc(80vh-120px)] mt-6">
      <div className="space-y-6 pr-4">
        {steps.map((step, index) => (
          <StepCard key={index} step={step} index={index} />
        ))}
      </div>
    </ScrollArea>
  </SheetContent>
</Sheet>
```

#### Desktop Layout (Dialog)

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
    <DialogHeader>
      <DialogTitle>Guía Rápida de Inicio</DialogTitle>
      <DialogDescription>
        Sigue estos pasos para crear tu primer asistente de IA
      </DialogDescription>
    </DialogHeader>

    <ScrollArea className="h-[60vh] pr-4">
      <div className="grid gap-4">
        {steps.map((step, index) => (
          <Card key={index}>
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  </DialogContent>
</Dialog>
```

---

## Shared Types

### AssistantTypeCardData

**Location**: `src/components/intelliaa/assistants/onboarding/types.ts`

```typescript
export interface AssistantTypeCardData {
  id: "voice" | "whatsapp" | "web";
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  badge?: "Popular" | "New" | "Próximamente";
  available: boolean;
  creationFlow: "vapi" | "direct" | "disabled";
}
```

**Field Descriptions**:

- `id`: Unique identifier matching assistant type in database
- `title`: Display name (e.g., "Asistente de Voz")
- `description`: One-line summary of assistant type
- `icon`: Lucide React icon component
- `features`: Array of feature strings for bullet list
- `badge`: Optional badge label for card corner
- `available`: Whether card is clickable or disabled
- `creationFlow`: Backend flow identifier

### ASSISTANT_TYPES Constant

```typescript
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
    creationFlow: "vapi",
  },
  {
    id: "whatsapp",
    title: "Asistente de WhatsApp",
    description: "Automatización de mensajería con IA conversacional",
    icon: MessageSquare,
    features: [
      "Respuestas automáticas 24/7",
      "Manejo de multimedia (imágenes, documentos)",
      "Integración con Railway backend",
      "Generación de QR para vinculación",
      "Despliegue en la nube",
    ],
    badge: "New",
    available: true,
    creationFlow: "direct",
  },
  {
    id: "web",
    title: "Asistente Web",
    description: "Chat widget embebible para tu sitio web",
    icon: Globe,
    features: [
      "Widget personalizable",
      "Integración con cualquier sitio",
      "Soporte multi-idioma",
      "Analytics en tiempo real",
      "APIs REST y webhooks",
    ],
    badge: "Próximamente",
    available: false,
    creationFlow: "disabled",
  },
];
```

---

## Props Documentation

### Props Validation Pattern

All components use TypeScript interfaces for prop validation:

```typescript
interface ComponentProps {
  requiredProp: string;
  optionalProp?: number;
  callbackProp?: (value: string) => void;
}

export function Component({
  requiredProp,
  optionalProp = 0,
  callbackProp,
}: ComponentProps) {
  // Component logic
}
```

### Common Props

**templates**:
- Type: `AssistantTemplate[]`
- Required in: `AssistantsOnboarding`, `AssistantTypeCard`, `CreateAssistantButton`
- Purpose: Pass template data to FormAdd for selection

**accountSlug**:
- Type: `string`
- Required in: `AssistantsOnboarding`, `AssistantTypeCard`
- Purpose: Routing context for navigation

**accountId**:
- Type: `string`
- Required in: `AssistantsOnboarding`
- Purpose: Database identifier for assistant creation

---

## State Management

### Local Component State

All client components use React `useState` for modal visibility:

```typescript
const [showModal, setShowModal] = useState(false);
```

**Why Local State?**
- Modal state is ephemeral (doesn't persist)
- No need for global state management
- Simple open/close toggle

### No Global State

Onboarding components do NOT use:
- Redux
- Zustand
- Context API
- SWR/React Query

**Rationale**:
- State is scoped to individual components
- No shared state between onboarding and master-detail
- Server-side data fetching handles templates

---

## Integration Points

### 1. Page Level Integration

**File**: `src/app/[accountSlug]/assistants/[[...assistantId]]/page.tsx`

```typescript
export default async function AssistantsPage({ params }: PageProps) {
  const { accountSlug } = await params;
  const supabase = await createClient();

  // Fetch assistants
  const assistantsResult = await getAssistantsList(accountId);
  const assistants = isError(assistantsResult) ? [] : assistantsResult;

  // Fetch templates ONCE
  const templatesResult = await getAssistantTemplates();
  const templates = isError(templatesResult) ? [] : templatesResult;

  // CONDITIONAL RENDERING
  if (assistants.length === 0) {
    return (
      <AssistantsOnboarding
        accountSlug={accountSlug}
        accountId={accountId}
        templates={templates}
      />
    );
  }

  return (
    <AssistantsMasterDetailLayout
      assistants={assistants}
      selectedAssistant={selectedAssistant}
      accountId={accountId}
      templates={templates}
    />
  );
}
```

### 2. Master-Detail Integration

**File**: `src/components/intelliaa/assistants/AssistantsMasterDetailLayout.tsx`

```typescript
export function AssistantsMasterDetailLayout({
  assistants,
  selectedAssistant,
  accountId,
  templates, // NEW
}: AssistantsMasterDetailLayoutProps) {
  return (
    <div className="flex h-screen">
      <AssistantsMasterPanel
        assistants={assistants}
        selectedId={selectedId}
        onSelectAssistant={handleSelectAssistant}
        templates={templates} // PASS DOWN
      />
      <AssistantsDetailPanel
        assistant={selectedAssistant}
        accountId={accountId}
      />
    </div>
  );
}
```

### 3. FormAdd Integration

**File**: `src/components/intelliaa/assistants/FormAdd.tsx`

No changes to FormAdd - it receives templates as before:

```typescript
<FormAddComponent
  dataTemplates={{ templates }}
  setOpenModal={setShowModal}
/>
```

---

## Code Examples

### Example 1: Adding a New Assistant Type

```typescript
// 1. Update types.ts
export const ASSISTANT_TYPES: AssistantTypeCardData[] = [
  // ... existing types
  {
    id: "email",
    title: "Asistente de Email",
    description: "Automatización de respuestas por correo electrónico",
    icon: Mail,
    features: [
      "Respuestas automáticas inteligentes",
      "Clasificación de prioridad",
      "Integración con Gmail/Outlook",
      "Detección de spam mejorada",
    ],
    badge: "New",
    available: true,
    creationFlow: "direct",
  },
];

// 2. Update database schema
// Add "email" to type_assistant enum in Supabase

// 3. Update FormAdd.tsx
// Add Email icon to type selection

// 4. Done! AssistantTypeCard automatically renders new type
```

### Example 2: Customizing Card Styles

```typescript
// Create custom variant in AssistantTypeCard.tsx
const cardVariants = {
  default: "hover:scale-105 hover:shadow-xl",
  subtle: "hover:translate-y-[-2px] hover:shadow-lg",
  bold: "hover:scale-110 hover:shadow-2xl hover:border-primary",
};

<Card
  className={`relative overflow-hidden transition-all duration-300 ${cardVariants.bold}`}
  onClick={handleCardClick}
>
  {/* Card content */}
</Card>
```

### Example 3: Adding Analytics

```typescript
// In AssistantTypeCard.tsx
import { analytics } from '@/lib/analytics';

const handleCardClick = () => {
  if (type.available) {
    // Track card click
    analytics.track('Onboarding Card Clicked', {
      assistantType: type.id,
      badge: type.badge,
      timestamp: Date.now(),
    });

    setShowModal(true);
  }
};
```

---

## Accessibility Considerations

### ARIA Labels

```tsx
<Card
  role="button"
  aria-label={`Create ${type.title} assistant`}
  aria-disabled={!type.available}
  tabIndex={type.available ? 0 : -1}
  onClick={handleCardClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }}
>
  {/* Card content */}
</Card>
```

### Keyboard Navigation

All interactive elements support:
- `Tab` - Move focus
- `Shift+Tab` - Move focus backward
- `Enter` / `Space` - Activate button/card
- `Esc` - Close dialog/sheet

### Screen Reader Support

```tsx
<DialogTitle id="dialog-title">
  Crear {type.title}
</DialogTitle>
<DialogDescription id="dialog-description">
  Selecciona una plantilla y configura tu asistente
</DialogDescription>
```

---

## Performance Optimization

### Code Splitting

```typescript
// Dynamic import for heavy components (if needed)
const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { loading: () => <Skeleton />, ssr: false }
);
```

### Memoization

```typescript
// Memoize expensive computations
const filteredTemplates = useMemo(
  () => templates.filter(t => t.type === assistantType),
  [templates, assistantType]
);
```

### Image Optimization

```tsx
// Use Next.js Image for template thumbnails
<Image
  src={template.image_url}
  alt={template.name}
  width={80}
  height={80}
  loading="lazy"
  placeholder="blur"
  blurDataURL={template.blur_data_url}
/>
```

---

## Component Checklist

When creating new components in this system:

- [ ] Define TypeScript interface for props
- [ ] Document purpose and responsibilities
- [ ] Add JSDoc comments for public methods
- [ ] Implement keyboard navigation
- [ ] Add ARIA labels for accessibility
- [ ] Test responsive breakpoints
- [ ] Verify color contrast (WCAG AA)
- [ ] Add loading and error states
- [ ] Write unit tests (if applicable)
- [ ] Update this documentation

---

## Conclusion

The onboarding component architecture is designed for:
- **Modularity**: Each component has a single responsibility
- **Reusability**: Components like CreateAssistantButton work in multiple contexts
- **Maintainability**: Clear separation of Server and Client components
- **Scalability**: Easy to add new assistant types or customize styling
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Server-side rendering with minimal client-side JavaScript
