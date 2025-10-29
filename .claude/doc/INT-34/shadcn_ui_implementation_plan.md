# shadcn/ui Implementation Plan: INT-34 - Assistant Configuration Editing UI/UX Enhancements

## Overview

This plan addresses UI/UX enhancements for the assistant configuration editing feature in the INT-34 epic. The current implementation has most form functionality complete but requires enhancements in:

1. **Unsaved Changes Dialog** - Prevent data loss when navigating away
2. **Comprehensive Validation Framework** - Migrate to React Hook Form + Zod pattern
3. **Skeleton Loading States** - Better initial load and save operation feedback
4. **Accessibility Improvements** - ARIA compliance, focus management, keyboard navigation
5. **Enhanced Error Messaging** - Consistent toast notifications and inline errors
6. **Responsive Design** - Mobile and tablet optimizations

**Component Type**: Client Component (`"use client"`)
**shadcn/ui Version**: Latest (with React 19 compatibility)
**Form Library**: React Hook Form v7.63.0 + Zod v3.25.76 (already installed)

---

## Component Architecture

### Current Architecture
```
TabAssistantVoice / TabAssistant (Parent)
  └── AssistantSettings (Settings Form)
      ├── Voice-specific fields OR WhatsApp-specific fields
      ├── Document storage assignment
      ├── Save/Delete buttons
      └── Multiple useState hooks for form state
```

### Enhanced Architecture
```
TabAssistantVoice / TabAssistant (Parent with useBlocker)
  ├── AssistantSettings (Form with React Hook Form)
  │   ├── FormProvider wrapper
  │   ├── Zod schema validation
  │   ├── FormField components with inline errors
  │   └── Skeleton states during load
  ├── UnsavedChangesDialog (Alert Dialog)
  └── Toast notifications (success/error feedback)
```

---

## File Changes

### Files to Create

#### 1. `/src/components/intelliaa/assistants/common/UnsavedChangesDialog.tsx`

**Purpose**: Reusable dialog component for unsaved changes warning
**Component Type**: Client Component
**Key Dependencies**: `@/components/ui/alert-dialog`, React Hook

**Complete Implementation**:

```typescript
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar cambios sin guardar?</AlertDialogTitle>
          <AlertDialogDescription>
            Tienes cambios sin guardar en la configuración del asistente. Si
            continúas, estos cambios se perderán.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Usage Pattern**:
- Import in parent component (TabAssistantVoice/TabAssistant)
- Track form dirty state via React Hook Form's `formState.isDirty`
- Trigger dialog when user attempts navigation with unsaved changes
- Use Next.js router events or custom navigation guard

**Integration Points**:
- Integrates with Next.js navigation using `useRouter()` and custom `useEffect` for navigation events
- Works with React Hook Form's dirty state tracking
- Can be triggered by assistant selection change in master-detail UI

---

#### 2. `/src/lib/schemas/assistantValidation.ts`

**Purpose**: Centralized Zod validation schemas for assistant configuration
**Component Type**: Utility (no component)
**Key Dependencies**: `zod`

**Complete Implementation**:

```typescript
import { z } from "zod";

// Base schema for common fields
const baseAssistantSchema = z.object({
  prompt: z
    .string()
    .min(20, "El prompt debe tener al menos 20 caracteres")
    .max(5000, "El prompt no puede exceder 5000 caracteres"),
  temperature: z
    .number()
    .min(0, "La temperatura debe ser al menos 0")
    .max(2, "La temperatura no puede exceder 2")
    .step(0.1, "La temperatura debe ser un decimal válido"),
  maxTokens: z
    .number()
    .int("Los tokens deben ser un número entero")
    .min(50, "Los tokens deben ser al menos 50")
    .max(4000, "Los tokens no pueden exceder 4000"),
  documentStorageId: z.string().optional(),
  voiceAssistantId: z.string().optional(),
});

// Voice assistant specific schema
export const voiceAssistantSchema = baseAssistantSchema.extend({
  welcomeMessage: z
    .string()
    .min(1, "El mensaje de bienvenida es requerido")
    .max(500, "El mensaje de bienvenida no puede exceder 500 caracteres"),
  endCallMessage: z
    .string()
    .min(1, "El mensaje de fin de llamada es requerido")
    .max(500, "El mensaje de fin de llamada no puede exceder 500 caracteres"),
  voicemailMessage: z
    .string()
    .min(1, "El mensaje de buzón de voz es requerido")
    .max(500, "El mensaje de buzón de voz no puede exceder 500 caracteres"),
  endCallPhrases: z
    .array(z.string().max(50, "Cada frase no puede exceder 50 caracteres"))
    .max(20, "No puede tener más de 20 frases"),
  recordCall: z.boolean(),
  detectEmotion: z.boolean(),
  backgroundOffice: z.boolean(),
  selectedDocuments: z.array(z.string()).optional(),
});

// WhatsApp assistant specific schema
export const whatsappAssistantSchema = baseAssistantSchema.extend({
  keywordTransfer: z
    .string()
    .min(1, "La palabra de transferencia es requerida")
    .max(50, "La palabra de transferencia no puede exceder 50 caracteres")
    .regex(
      /^[A-Z0-9_]+$/,
      "Debe ser mayúsculas, números o guiones bajos solamente"
    ),
  numberTransfer: z
    .string()
    .regex(
      /^[0-9]{10,15}$/,
      "Debe ser un número válido de 10-15 dígitos sin símbolos"
    )
    .optional()
    .or(z.literal("")),
  selectedDocumentStorage: z.string().optional(),
});

// Export types for TypeScript
export type VoiceAssistantFormData = z.infer<typeof voiceAssistantSchema>;
export type WhatsAppAssistantFormData = z.infer<typeof whatsappAssistantSchema>;
```

**Usage Pattern**:
- Import schema in AssistantSettings components
- Use with React Hook Form's `zodResolver`
- Provides type-safe form data types
- Centralizes all validation logic for maintainability

---

#### 3. `/src/components/intelliaa/assistants/common/FormSkeletons.tsx`

**Purpose**: Skeleton loading states for assistant forms
**Component Type**: Client Component
**Key Dependencies**: `@/components/ui/skeleton`, `@/components/ui/card`

**Complete Implementation**:

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VoiceAssistantFormSkeleton() {
  return (
    <Card className="flex flex-col w-[100%] text-muted-foreground dark:bg-[#242322]/80 dark:border-gray-700">
      {/* Header with buttons skeleton */}
      <div className="flex justify-end gap-2 items-center pt-6 mr-2">
        <Skeleton className="h-10 w-40" /> {/* Iniciar llamada button */}
        <Skeleton className="h-10 w-32" /> {/* Guardar button */}
        <Skeleton className="h-10 w-10" /> {/* Delete button */}
      </div>

      <div className="flex py-6">
        {/* Left column - Main fields */}
        <CardContent className="w-[70%]">
          <div className="space-y-6">
            {/* Welcome message */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-32 w-full" />
            </div>

            {/* End call message */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>

            {/* Voicemail message */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </CardContent>

        {/* Right column - Settings */}
        <CardContent className="w-[30%] px-2">
          <div className="space-y-6">
            {/* Temperature slider */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>

            {/* Max tokens slider */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>

            {/* Documents dropdown */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Voice selector */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>

            {/* Switches */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>

            {/* End call phrases */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export function WhatsAppAssistantFormSkeleton() {
  return (
    <Card className="w-[60%] text-muted-foreground pt-6 dark:bg-[#242322]/80 dark:border-gray-700">
      <CardContent>
        {/* Header with buttons skeleton */}
        <div className="flex justify-end gap-2 items-center">
          <Skeleton className="h-10 w-48" /> {/* Publicar button */}
          <Skeleton className="h-10 w-32" /> {/* Guardar button */}
          <Skeleton className="h-10 w-10" /> {/* Delete button */}
        </div>

        <div className="flex flex-col space-y-4 mt-6">
          {/* Prompt */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-32 w-[95%]" />
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-[95%]" />
          </div>

          {/* Max tokens */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-[95%]" />
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-[95%]" />
          </div>

          {/* Voice */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-[180px]" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>

          {/* Document storage assignment */}
          <div className="space-y-2 py-6 border-t">
            <Skeleton className="h-6 w-full" />
          </div>

          {/* WhatsApp options header */}
          <Skeleton className="h-6 w-48" />

          {/* Keyword transfer */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-[95%]" />
          </div>

          {/* Number transfer */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-[95%]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Usage Pattern**:
- Display while fetching assistant data from Supabase
- Replace with actual form once data loads
- Maintains layout consistency (no layout shift)
- Respects dark/light theme

---

### Files to Modify

#### 1. `/src/components/intelliaa/assistants/voice/AssistantSettings.tsx`

**Changes Required**:

1. **Add React Hook Form integration**:
```typescript
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { voiceAssistantSchema, VoiceAssistantFormData } from "@/lib/schemas/assistantValidation";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
```

2. **Replace useState hooks with useForm**:
```typescript
// BEFORE: Multiple useState hooks
const [promptState, setPromptState] = useState(assistant.prompt);
const [temperatureState, setTemperatureState] = useState(assistant.temperature);
// ... many more

// AFTER: Single form instance
const form = useForm<VoiceAssistantFormData>({
  resolver: zodResolver(voiceAssistantSchema),
  defaultValues: {
    prompt: assistant.prompt,
    temperature: assistant.temperature,
    maxTokens: assistant.token,
    welcomeMessage: assistant.welcomeMessage || "",
    endCallMessage: assistant.endCallMessage || "",
    voicemailMessage: assistant.voicemailMessage || "",
    endCallPhrases: assistant.endCallPhrases || [],
    recordCall: assistant.recordCall || false,
    detectEmotion: assistant.detectEmotion || false,
    backgroundOffice: assistant.backgroundOffice || false,
    selectedDocuments: assistant.docs_keys || [],
    voiceAssistantId: assistant.voice_assistant_selected || "",
    documentStorageId: assistant.document_storage_id || "",
  },
});

// Track form dirty state for unsaved changes
const { isDirty } = form.formState;
```

3. **Wrap form in FormProvider**:
```typescript
return (
  <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(handleSaveAssistant)}>
      <Card className='flex flex-col w-[100%]...'>
        {/* Existing card content */}
      </Card>
    </form>
  </FormProvider>
);
```

4. **Convert fields to FormField components** (example for Prompt):
```typescript
// BEFORE
<Textarea
  name='prompt'
  placeholder='Prompt'
  className='mx-1 w-[95%] min-h-[150px]'
  onChange={(e) => {
    setPromptState(e.target.value);
    setIsChangeOptions(true);
  }}
  value={promptState}
/>

// AFTER
<FormField
  control={form.control}
  name="prompt"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        <span className='flex items-center gap-1'>
          Prompt
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className='text-primary cursor-pointer' size={14} />
              </TooltipTrigger>
              <TooltipContent side='bottom' align='center' className='p-4 w-[300px]'>
                <p className='font-normal text-mute-foreground'>
                  Ingrese aquí el mensaje o pregunta que desea enviar al asistente...
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </FormLabel>
      <FormControl>
        <Textarea
          placeholder='Prompt'
          className='mx-1 w-[95%] max-h-[500px] min-h-[150px]'
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

5. **Update save handler**:
```typescript
const handleSaveAssistant = async (data: VoiceAssistantFormData) => {
  setLoadingAssistant(true);

  try {
    // Call API with validated data
    const response = await fetch("/api/update-assistant-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: assistant.id,
        ...data,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update assistant");
    }

    const result = await response.json();

    toast({
      title: "Asistente actualizado",
      description: "Los cambios se guardaron correctamente.",
      variant: "default",
    });

    // Reset form dirty state after successful save
    form.reset(data);
  } catch (error) {
    console.error("Error updating assistant:", error);

    toast({
      title: "Error al guardar",
      description: "No se pudieron guardar los cambios. Por favor, intente de nuevo.",
      variant: "destructive",
    });
  } finally {
    setLoadingAssistant(false);
  }
};
```

6. **Add toast hook**:
```typescript
import { useToast } from "@/components/ui/use-toast";

// In component
const { toast } = useToast();
```

7. **Update loading state rendering**:
```typescript
// Add at component top level
if (loadingAssistant && !form.formState.isSubmitting) {
  return <VoiceAssistantFormSkeleton />;
}
```

**Reason**: Provides comprehensive validation, reduces boilerplate, improves type safety, better error handling

---

#### 2. `/src/components/intelliaa/assistants/whatsapp/AssistantSettings.tsx`

**Changes Required**: Similar to Voice assistant, but using `whatsappAssistantSchema`

1. **Add React Hook Form integration**:
```typescript
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { whatsappAssistantSchema, WhatsAppAssistantFormData } from "@/lib/schemas/assistantValidation";
```

2. **Initialize form**:
```typescript
const form = useForm<WhatsAppAssistantFormData>({
  resolver: zodResolver(whatsappAssistantSchema),
  defaultValues: {
    prompt: assistant.prompt,
    temperature: assistant.temperature,
    maxTokens: assistant.token,
    keywordTransfer: assistant.keywordTransfer || "",
    numberTransfer: assistant.numberTransfer || "",
    selectedDocumentStorage: assistant.document_storage_id || "",
    voiceAssistantId: assistant.voice_assistant_selected || "",
    documentStorageId: assistant.document_storage_id || "",
  },
});
```

3. **Special handling for disabled fields** (WhatsApp-specific):
```typescript
<FormField
  control={form.control}
  name="keywordTransfer"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        {/* Tooltip content */}
      </FormLabel>
      <FormControl>
        <Input
          placeholder='TRANSFERIR'
          className='mx-1 w-[95%]'
          disabled={isWhatsappActivated} // Disabled after WhatsApp activation
          {...field}
        />
      </FormControl>
      <FormMessage />
      {isWhatsappActivated && (
        <FormDescription>
          Esta palabra no se puede editar después de publicar en WhatsApp
        </FormDescription>
      )}
    </FormItem>
  )}
/>
```

4. **Custom validation for number transfer**:
```typescript
// Already handled by Zod schema, but add visual feedback
<FormField
  control={form.control}
  name="numberTransfer"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        <span className='flex items-center gap-1'>
          Transferencia de número de Whatsapp.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className='text-primary cursor-pointer' size={14} />
              </TooltipTrigger>
              <TooltipContent side='bottom' align='center' className='p-4 w-[300px]'>
                <p className='font-normal text-mute-foreground'>
                  Ingrese un número telefónico de WhatsApp al cual se pueda transferir
                  la conversación con el cliente. Asegúrese de que el número cumpla con
                  el formato 1XXX XXXXXXX, donde el 1 es el código de país.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </FormLabel>
      <FormControl>
        <Input
          className='mx-1 w-[95%]'
          type='text'
          placeholder='1123456789'
          {...field}
        />
      </FormControl>
      <FormMessage />
      <FormDescription>
        Formato: 10-15 dígitos numéricos (ej: 1123456789)
      </FormDescription>
    </FormItem>
  )}
/>
```

**Reason**: Same benefits as voice assistant, with special handling for WhatsApp-specific constraints

---

#### 3. `/src/components/intelliaa/assistants/voice/TabAssistantVoice.tsx`

**Changes Required**:

1. **Add navigation guard for unsaved changes**:
```typescript
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesDialog } from "../common/UnsavedChangesDialog";

export default function TabAssistantVoice({ assistant }: TabAssistantVoiceProps) {
  const router = useRouter();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Track form dirty state from child component
  const handleFormDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Prevent browser navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Handle navigation within app (assistant selection change)
  const handleAssistantChange = (newAssistantId: string) => {
    if (isDirty) {
      setPendingNavigation(newAssistantId);
      setShowUnsavedDialog(true);
    } else {
      // Navigate immediately if no unsaved changes
      router.push(`/assistants/${newAssistantId}`);
    }
  };

  const handleConfirmNavigation = () => {
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      router.push(`/assistants/${pendingNavigation}`);
      setPendingNavigation(null);
      setIsDirty(false);
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  return (
    <>
      <Tabs defaultValue='settings' className='w-[100%]'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='settings'>Ajustes</TabsTrigger>
          <TabsTrigger value='storages'>Storages</TabsTrigger>
          <TabsTrigger value='embed'>Incrustar</TabsTrigger>
        </TabsList>

        <TabsContent value='settings'>
          <AssistantSettings
            assistant={assistant}
            onFormDirtyChange={handleFormDirtyChange}
            // ... other props
          />
        </TabsContent>

        {/* Other tabs */}
      </Tabs>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
      />
    </>
  );
}
```

2. **Update AssistantSettings to expose dirty state**:
```typescript
// In AssistantSettings component props
interface AssistantSettingsProps {
  // ... existing props
  onFormDirtyChange?: (dirty: boolean) => void;
}

// In component body
const { isDirty } = form.formState;

useEffect(() => {
  onFormDirtyChange?.(isDirty);
}, [isDirty, onFormDirtyChange]);
```

**Reason**: Prevents accidental data loss, improves user experience, follows web best practices

---

#### 4. `/src/components/intelliaa/assistants/whatsapp/TabAssistant.tsx`

**Changes Required**: Same navigation guard pattern as Voice assistant

**Reason**: Consistent UX across both assistant types

---

#### 5. `/src/app/layout.tsx` (Root Layout)

**Changes Required**: Ensure Toaster is mounted

```typescript
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Reason**: Toast notifications require Toaster component to be in component tree

---

## Configuration Updates

### No changes required to `tailwind.config.ts`
The existing configuration already supports all needed components.

### No changes required to `globals.css`
Current design tokens are sufficient. The plan respects existing theme variables:
- `--destructive` for error states
- `--primary` for accent colors
- `--muted-foreground` for secondary text
- Dark mode variants already defined

### No changes required to `components.json`
All needed shadcn/ui components are already installed:
- ✅ Alert Dialog
- ✅ Form components
- ✅ Skeleton
- ✅ Toast
- ✅ Button, Input, Textarea, Slider, Select, Switch, Label, Tooltip

---

## Installation Steps

**No new shadcn/ui components needed** - all required components are already installed.

**No new npm packages needed** - React Hook Form and Zod are already installed:
- `react-hook-form@^7.63.0` ✅
- `zod@^3.25.76` ✅
- `@hookform/resolvers@^3.10.0` ✅

---

## Integration Points

### 1. **Form State Management**
- **Current**: Multiple `useState` hooks tracking individual fields
- **Enhanced**: Single `useForm` instance with centralized state
- **Migration**: Gradual replacement of useState with form.control

### 2. **Validation Flow**
- **Current**: Inline validation in onChange handlers
- **Enhanced**: Zod schema validation with automatic error messaging
- **Integration**: FormField automatically displays validation errors via FormMessage

### 3. **Save Operations**
- **Current**: Manual data collection in handleSaveAssistant
- **Enhanced**: Type-safe form submission with handleSubmit
- **Integration**: Automatic validation before submission

### 4. **Navigation Guards**
- **Current**: No unsaved changes protection
- **Enhanced**: Browser and in-app navigation guards
- **Integration**: useEffect hooks + AlertDialog component

### 5. **Loading States**
- **Current**: Boolean loading state with disabled buttons
- **Enhanced**: Skeleton screens + form submission state
- **Integration**: Conditional rendering based on loading state

### 6. **Error Feedback**
- **Current**: Console errors + basic toast calls
- **Enhanced**: Structured toast notifications with useToast hook
- **Integration**: Try-catch blocks in save handlers with toast feedback

---

## Accessibility Considerations

### Current State Assessment

**Strengths**:
- ✅ Tooltips provide contextual help
- ✅ Labels associated with form controls
- ✅ Semantic HTML structure (form, button, input elements)

**Areas for Improvement**:

1. **Keyboard Navigation**
   - ❌ Modal dialogs don't trap focus
   - ❌ No visible focus indicators on custom components
   - ❌ Tab order unclear in complex layouts

2. **Screen Reader Support**
   - ❌ Form validation errors not announced
   - ❌ Loading states not communicated
   - ❌ Dynamic content changes (toast) not announced

3. **ARIA Patterns**
   - ❌ Missing `aria-live` regions for dynamic updates
   - ❌ No `aria-busy` during loading states
   - ❌ Incomplete `aria-describedby` for help text

### Enhancement Recommendations

#### 1. **Focus Management**

**Add visible focus indicators** in `globals.css`:
```css
/* Enhanced focus visible styles */
@layer base {
  *:focus-visible {
    @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
  }
}
```

**Trap focus in dialogs** (UnsavedChangesDialog):
```typescript
import { Dialog, DialogOverlay, DialogContent } from "@radix-ui/react-dialog";
// Radix UI automatically handles focus trapping - already implemented! ✅
```

**Manage focus on form errors**:
```typescript
// In handleSaveAssistant, after validation fails
const handleSaveAssistant = async (data: VoiceAssistantFormData) => {
  try {
    // ... save logic
  } catch (error) {
    // Focus first error field
    const firstError = Object.keys(form.formState.errors)[0];
    if (firstError) {
      form.setFocus(firstError as keyof VoiceAssistantFormData);
    }
  }
};
```

#### 2. **Screen Reader Announcements**

**Add live region for toast notifications**:
```typescript
// Already handled by shadcn/ui Toast component via role="status" ✅
```

**Add aria-live for form submission**:
```typescript
<Button
  type="submit"
  disabled={!isDirty || loadingAssistant}
  aria-busy={loadingAssistant}
  aria-live="polite"
>
  {loadingAssistant ? (
    <>
      <Loader2 size={17} className='animate-spin text-white mr-2' />
      <span className="sr-only">Guardando cambios...</span>
      Guardando...
    </>
  ) : (
    <>
      <Save size={17} className='mr-2' />
      Guardar
    </>
  )}
</Button>
```

**Add loading state announcement**:
```typescript
// In skeleton screen
<div role="status" aria-live="polite" aria-label="Cargando configuración del asistente">
  <VoiceAssistantFormSkeleton />
  <span className="sr-only">Cargando formulario...</span>
</div>
```

#### 3. **ARIA Attributes Enhancement**

**FormField automatically provides** (via shadcn/ui Form component):
- ✅ `aria-invalid` on error
- ✅ `aria-describedby` linking to error message
- ✅ `id` attributes for label association

**Add aria-required for required fields**:
```typescript
<FormField
  control={form.control}
  name="prompt"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        Prompt <span aria-label="requerido" className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <Textarea
          placeholder='Prompt'
          aria-required="true"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Add descriptive labels for sliders**:
```typescript
<Slider
  name='temperature'
  max={1}
  step={0.1}
  aria-label={`Temperatura: ${temperatureValue}`}
  aria-valuemin={0}
  aria-valuemax={1}
  aria-valuenow={temperatureValue}
  aria-valuetext={`${temperatureValue} - ${getTemperatureDescription(temperatureValue)}`}
  onValueChange={([value]) => field.onChange(value)}
  value={[field.value]}
/>
```

**Helper function for slider descriptions**:
```typescript
function getTemperatureDescription(temp: number): string {
  if (temp < 0.3) return "Muy preciso";
  if (temp < 0.7) return "Equilibrado";
  return "Muy creativo";
}
```

#### 4. **Keyboard Shortcuts**

**Add save shortcut**:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (isDirty) {
        form.handleSubmit(handleSaveAssistant)();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isDirty, form]);
```

**Add escape to cancel dialog**:
```typescript
// Already handled by AlertDialog component ✅
```

#### 5. **WCAG 2.1 AA Compliance Checklist**

- ✅ **1.3.1 Info and Relationships**: Form fields properly labeled
- ✅ **1.4.3 Contrast**: Using CSS variables ensures sufficient contrast
- ✅ **2.1.1 Keyboard**: All functionality accessible via keyboard
- ✅ **2.4.3 Focus Order**: Logical tab order in DOM structure
- ✅ **2.4.7 Focus Visible**: Enhanced focus indicators added
- ✅ **3.2.2 On Input**: No automatic form submission on input
- ✅ **3.3.1 Error Identification**: Errors clearly identified in text
- ✅ **3.3.2 Labels or Instructions**: All fields have labels + tooltips
- ✅ **3.3.3 Error Suggestion**: Validation messages provide guidance
- ✅ **4.1.2 Name, Role, Value**: ARIA attributes properly implemented

---

## Responsive Design Strategy

### Current State Assessment

**Voice Assistant Form**:
- Desktop: Two-column layout (70% main / 30% sidebar)
- Issue: No mobile breakpoints defined
- Issue: Fixed widths may cause overflow on small screens

**WhatsApp Assistant Form**:
- Desktop: Single column, fixed 60% width
- Issue: Fixed width not responsive
- Issue: Long labels may wrap awkwardly

### Mobile-First Breakpoints

**Tailwind Breakpoints**:
- `sm`: 640px (small tablets, large phones in landscape)
- `md`: 768px (tablets)
- `lg`: 1024px (desktops)
- `xl`: 1280px (large desktops)

### Enhancement Recommendations

#### 1. **Voice Assistant Responsive Layout**

**Current**:
```typescript
<div className='flex py-6'>
  <CardContent className='w-[70%]'>
    {/* Main fields */}
  </CardContent>
  <CardContent className='w-[30%] px-2'>
    {/* Settings sidebar */}
  </CardContent>
</div>
```

**Enhanced**:
```typescript
<div className='flex flex-col lg:flex-row py-6 gap-4'>
  <CardContent className='w-full lg:w-[70%]'>
    {/* Main fields */}
  </CardContent>
  <CardContent className='w-full lg:w-[30%] px-2'>
    {/* Settings sidebar - stacks below on mobile */}
  </CardContent>
</div>
```

**Key Changes**:
- `flex-col` on mobile → vertical stack
- `lg:flex-row` on desktop → side-by-side
- `w-full` on mobile → full width
- `lg:w-[70%]` on desktop → column layout
- `gap-4` → consistent spacing

#### 2. **WhatsApp Assistant Responsive Layout**

**Current**:
```typescript
<Card className='w-[60%] text-muted-foreground pt-6...'>
```

**Enhanced**:
```typescript
<Card className='w-full lg:w-[70%] xl:w-[60%] text-muted-foreground pt-6...'>
```

**Key Changes**:
- `w-full` on mobile → full width
- `lg:w-[70%]` on tablets → slightly narrower
- `xl:w-[60%]` on large screens → original width

#### 3. **Form Field Responsive Patterns**

**Textarea widths**:
```typescript
// BEFORE
<Textarea className='mx-1 w-[95%] min-h-[150px]' />

// AFTER
<Textarea className='w-full md:w-[95%] min-h-[150px]' />
```

**Button groups** (header buttons):
```typescript
// BEFORE
<div className='flex justify-end gap-2 items-center pt-6 mr-2'>

// AFTER
<div className='flex flex-col sm:flex-row justify-end gap-2 items-stretch sm:items-center pt-6 px-4 sm:mr-2'>
  <Button className='w-full sm:w-auto'>Iniciar llamada</Button>
  <Button className='w-full sm:w-auto'>Guardar</Button>
</div>
```

**Key Changes**:
- `flex-col` on mobile → stacked full-width buttons
- `sm:flex-row` on tablets+ → horizontal layout
- `w-full sm:w-auto` → responsive button widths
- `px-4 sm:mr-2` → consistent padding

#### 4. **Voice Selector Responsive**

**Current**:
```typescript
<div className='flex items-center mb-4'>
  <Select>...</Select>
  <Button size='icon' className='ml-4'>Play</Button>
</div>
```

**Enhanced**:
```typescript
<div className='flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-4'>
  <div className='w-full sm:w-auto'>
    <Select>
      <SelectTrigger className='w-full sm:w-[180px]'>
        <SelectValue placeholder='Selecciona una voz' />
      </SelectTrigger>
      {/* ... */}
    </Select>
  </div>
  <Button
    onClick={handlePlayAudio}
    variant='outline'
    size='icon'
    className='self-end sm:self-auto rounded-full border-primary'
  >
    <Play className='text-primary' />
  </Button>
</div>
```

#### 5. **Tooltip Responsive Behavior**

**Current**: Tooltips always appear on hover
**Enhancement**: Consider touch-friendly alternative for mobile

```typescript
<TooltipProvider delayDuration={0}>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        type="button"
        onTouchStart={(e) => {
          // Prevent default to avoid double-firing on mobile
          e.preventDefault();
        }}
      >
        <HelpCircle className='text-primary cursor-pointer' size={14} />
      </Button>
    </TooltipTrigger>
    <TooltipContent
      side='bottom'
      align='center'
      className='p-4 w-[90vw] sm:w-[300px]'
    >
      <p className='font-normal text-mute-foreground'>
        {/* Tooltip text */}
      </p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Key Changes**:
- `w-[90vw] sm:w-[300px]` → responsive tooltip width
- Touch event handling for mobile
- Wraps in button for better accessibility

#### 6. **Card Container Responsive**

**Voice Assistant Card**:
```typescript
<Card className='
  flex flex-col
  w-full
  text-muted-foreground
  dark:bg-[#242322]/80
  dark:border-gray-700
  dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)]
  overflow-y-auto
  max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-150px)]
'>
```

**WhatsApp Assistant Card**:
```typescript
<Card className='
  w-full
  lg:w-[70%]
  xl:w-[60%]
  text-muted-foreground
  pt-6
  dark:bg-[#242322]/80
  dark:border-gray-700
  dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)]
  overflow-y-auto
  max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-150px)]
'>
```

#### 7. **Spacing and Typography**

**Responsive spacing utilities**:
```typescript
// Labels
<Label className='mb-2 text-sm sm:text-base'>

// Headings
<p className='mb-4 text-base sm:text-lg font-semibold'>

// Form sections
<div className='flex flex-col space-y-4 sm:space-y-6'>
```

### Mobile-Specific Optimizations

#### 1. **Touch Targets**
Ensure minimum 44x44px touch targets:

```typescript
<Button
  size='icon'
  className='min-h-[44px] min-w-[44px] sm:h-10 sm:w-10'
>
  <Play />
</Button>
```

#### 2. **Scroll Behavior**
```typescript
<ScrollArea className='h-[calc(100vh-250px)] sm:h-auto'>
  {/* Form content */}
</ScrollArea>
```

#### 3. **Input Modes**
```typescript
<Input
  type='tel'
  inputMode='numeric'
  pattern='[0-9]*'
  placeholder='1123456789'
  {...field}
/>
```

#### 4. **Viewport Meta Tag**
Ensure in layout:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
```

### Tablet-Specific Considerations (768px - 1024px)

**Medium breakpoint strategy**:
- Forms at 80-90% width for comfortable reading
- Two-column layout for voice assistant at `lg:` breakpoint
- Tooltips remain full-featured (not simplified like mobile)

```typescript
<Card className='
  w-full
  md:w-[90%]
  lg:w-[80%]
  xl:w-[60%]
  mx-auto
'>
```

---

## Theme Integration

### Current Theme System

The project uses CSS variables for theming with light/dark mode support:

**Light Mode Variables**:
- `--background: 0 0% 98%`
- `--foreground: 210 20% 94%`
- `--primary: 173.4 80.4% 40%` (Teal accent)
- `--destructive: 0 84.2% 60.2%` (Red for errors)

**Dark Mode Variables**:
- `--background: 24 9.8% 10%`
- `--foreground: 12 6.5% 15.1%`
- `--primary: 173.4 80.4% 40%` (Same teal - maintains brand)
- `--destructive: 0 62.8% 30.6%` (Darker red)

### Hydration-Safe Theme Implementation

**Issue**: Server renders light mode, client may apply dark mode → mismatch

**Solution**: Already implemented in project with `next-themes`

**Verification in components**:
```typescript
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemedComponent() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render skeleton or neutral state during SSR
    return <FormSkeleton />;
  }

  // Safe to render theme-dependent content
  return (
    <div className="dark:bg-[#242322]/80">
      {/* Content */}
    </div>
  );
}
```

### Form-Specific Theme Considerations

#### 1. **Error State Colors**

**Light Mode**:
```css
.text-destructive {
  color: hsl(0 84.2% 60.2%); /* Bright red */
}
```

**Dark Mode**:
```css
.dark .text-destructive {
  color: hsl(0 62.8% 30.6%); /* Muted red */
}
```

**Usage in FormMessage**:
```typescript
<FormMessage /> // Automatically uses --destructive color
```

#### 2. **Input Focus States**

**Both themes use consistent ring**:
```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--ring));
}

:root {
  --ring: 142.1 76.2% 36.3%; /* Teal ring */
}

.dark {
  --ring: 142.4 71.8% 29.2%; /* Slightly darker teal */
}
```

#### 3. **Card Background Shadows**

**Custom dark mode effect** (already in components):
```typescript
<Card className='
  dark:bg-[#242322]/80
  dark:border-gray-700
  dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)]
'>
```

**Maintains branding**: The `rgba(20,184,166,0.2)` is the primary teal color

#### 4. **Skeleton States**

**Theme-aware skeletons**:
```typescript
// Skeleton component automatically uses muted colors
<Skeleton className="h-10 w-full" />

// In globals.css (if not already present)
.dark .skeleton {
  background-color: hsl(var(--muted));
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

#### 5. **Toast Notifications**

**Default toast** (success):
```typescript
toast({
  title: "Asistente actualizado",
  description: "Los cambios se guardaron correctamente.",
  // Uses default background (--card) and foreground (--card-foreground)
});
```

**Destructive toast** (error):
```typescript
toast({
  variant: "destructive",
  title: "Error al guardar",
  description: "No se pudieron guardar los cambios.",
  // Uses --destructive background and --destructive-foreground
});
```

### Theme Testing Checklist

Before deployment, verify:

- [ ] Form validation errors visible in both themes
- [ ] Focus indicators have sufficient contrast
- [ ] Disabled states clearly distinguishable
- [ ] Loading spinners visible against background
- [ ] Toast notifications readable in both themes
- [ ] Placeholder text meets contrast requirements (WCAG AA: 4.5:1)
- [ ] No hydration mismatches in browser console

### Dark Mode Specific Enhancements

**Optional**: Add subtle glow to focused inputs in dark mode

```css
/* In globals.css */
@layer base {
  .dark input:focus-visible,
  .dark textarea:focus-visible {
    box-shadow:
      0 0 0 2px hsl(var(--ring)),
      0 0 8px 0 hsla(var(--primary), 0.3);
  }
}
```

---

## Important Notes & Warnings

### 1. **React 19 Compatibility**

**Current Status**: ✅ All dependencies compatible
- `react-hook-form@7.63.0` supports React 19
- `zod@3.25.76` supports React 19
- `@hookform/resolvers@3.10.0` supports React 19

**Warning**: If you see peer dependency warnings during install, use `--legacy-peer-deps` flag (already project standard)

### 2. **Next.js 15 Async APIs**

**Client Components are safe**: The AssistantSettings components are Client Components (`"use client"`) and don't use async request APIs.

**If you need server data**:
```typescript
// In parent Server Component
async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Must await
  const supabase = await createClient(); // Must await
  const { data: assistant } = await supabase
    .from("assistants")
    .select("*")
    .eq("id", id)
    .single();

  return <TabAssistantVoice assistant={assistant} />;
}
```

### 3. **Form State Persistence**

**Issue**: When switching between assistants, form state needs reset

**Solution**: Use `key` prop + React Hook Form's `reset()`

```typescript
// In parent component
<AssistantSettings
  key={assistant.id} // Force remount on assistant change
  assistant={assistant}
  // ... props
/>

// OR manually reset in useEffect
useEffect(() => {
  form.reset({
    prompt: assistant.prompt,
    temperature: assistant.temperature,
    // ... all fields
  });
}, [assistant.id]); // Reset when assistant changes
```

### 4. **Validation Performance**

**Zod schemas run on every keystroke** with `mode: "onChange"` (default)

**Optimization options**:

```typescript
// Option 1: Validate on blur (better performance)
const form = useForm<VoiceAssistantFormData>({
  resolver: zodResolver(voiceAssistantSchema),
  mode: "onBlur", // Only validate when field loses focus
});

// Option 2: Validate on submit only (best performance)
const form = useForm<VoiceAssistantFormData>({
  resolver: zodResolver(voiceAssistantSchema),
  mode: "onSubmit", // Only validate on form submission
  reValidateMode: "onChange", // After first submit, validate on change
});
```

**Recommendation**: Use `mode: "onBlur"` for better UX balance

### 5. **TypeScript Strict Mode**

**Form field types must match schema**:

```typescript
// BAD - Type mismatch
<FormField
  name="temperature"
  render={({ field }) => (
    <Slider
      {...field}
      value={[field.value]} // field.value is number
      onValueChange={([value]) => field.onChange(value.toString())} // ❌ Wrong type
    />
  )}
/>

// GOOD - Correct types
<FormField
  name="temperature"
  render={({ field }) => (
    <Slider
      {...field}
      value={[field.value]} // number
      onValueChange={([value]) => field.onChange(value)} // ✅ number
    />
  )}
/>
```

### 6. **Unsaved Changes Edge Cases**

**Browser back button**: `beforeunload` event prevents accidental navigation

**Programmatic navigation**: Use router guard pattern shown in TabAssistant changes

**Tab close**: Browser shows native "Leave site?" dialog

**Known limitation**: Cannot customize browser's native dialog text (security restriction)

### 7. **Toast Notification Limits**

**Current config**: `TOAST_LIMIT = 1` in `use-toast.ts`

**Implication**: Only one toast shown at a time (old toast dismissed automatically)

**If you need multiple toasts**:
```typescript
// In use-toast.ts
const TOAST_LIMIT = 3; // Allow up to 3 simultaneous toasts
```

### 8. **Skeleton State Flicker**

**Issue**: Fast API responses may cause skeleton to flash briefly

**Solution**: Add minimum display time

```typescript
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const start = Date.now();
    const data = await loadAssistant();

    // Ensure skeleton shows for at least 300ms
    const elapsed = Date.now() - start;
    if (elapsed < 300) {
      await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
    }

    setIsLoading(false);
  };

  fetchData();
}, []);
```

### 9. **ARIA Attribute Conflicts**

**shadcn/ui Form components automatically add ARIA attributes**

**Don't duplicate**:
```typescript
// BAD - Duplicate aria-invalid
<FormField
  render={({ field }) => (
    <Input
      aria-invalid={!!form.formState.errors.prompt} // ❌ FormControl already adds this
      {...field}
    />
  )}
/>

// GOOD - Let FormControl handle it
<FormField
  render={({ field }) => (
    <FormControl>
      <Input {...field} /> // ✅ ARIA attributes added automatically
    </FormControl>
  )}
/>
```

### 10. **Mobile Safari Input Zoom**

**Issue**: iOS Safari zooms in on inputs with font-size < 16px

**Solution**: Ensure minimum 16px font size on mobile

```typescript
// In tailwind.config.ts, verify base input size
<Input className='text-base' /> // Ensures 16px on all devices

// OR globally in globals.css
@layer base {
  input, textarea, select {
    @apply text-base; /* 16px */
  }
}
```

---

## Migration Path

### Phase 1: Foundation (Week 1)

**Goal**: Set up validation infrastructure without breaking existing functionality

1. **Create validation schemas** (`/src/lib/schemas/assistantValidation.ts`)
   - Define Zod schemas
   - Export TypeScript types
   - Test schemas in isolation

2. **Create skeleton components** (`/src/components/intelliaa/assistants/common/FormSkeletons.tsx`)
   - Implement Voice and WhatsApp skeletons
   - Match existing layout exactly
   - Test in both themes

3. **Create UnsavedChangesDialog** (`/src/components/intelliaa/assistants/common/UnsavedChangesDialog.tsx`)
   - Implement dialog component
   - Add to Storybook (if available)
   - Test accessibility

**Validation**: No changes to existing forms yet, all new components isolated

### Phase 2: Voice Assistant Migration (Week 2)

**Goal**: Migrate Voice assistant form to React Hook Form

1. **Update AssistantSettings.tsx** (Voice)
   - Add React Hook Form imports
   - Initialize form with useForm
   - Keep existing useState as fallback
   - Test form initialization

2. **Convert fields one-by-one**
   - Start with simple fields (prompt, temperature)
   - Verify each field works before moving to next
   - Test validation on each field
   - Maintain existing onChange behavior during transition

3. **Update save handler**
   - Integrate form.handleSubmit
   - Add toast notifications
   - Test error scenarios
   - Verify Supabase + VAPI updates work

4. **Add loading states**
   - Implement skeleton on initial load
   - Test with slow network throttling
   - Verify no layout shift

5. **Remove old useState hooks**
   - After all fields converted
   - Clean up unused state
   - Remove old change tracking

**Validation**: Voice assistant form fully functional with validation

### Phase 3: WhatsApp Assistant Migration (Week 2-3)

**Goal**: Apply same pattern to WhatsApp assistant

1. **Repeat Phase 2 steps** for WhatsApp AssistantSettings.tsx
   - Use whatsappAssistantSchema
   - Handle disabled field states
   - Test WhatsApp-specific validation (phone number, keyword)

2. **Add document storage integration**
   - Ensure AssignStorageSectionWhatsApp works with new form
   - Test document assignment flow

**Validation**: Both assistant types use React Hook Form

### Phase 4: Navigation Guards (Week 3)

**Goal**: Prevent data loss from navigation

1. **Update TabAssistantVoice**
   - Add navigation guard logic
   - Integrate UnsavedChangesDialog
   - Test assistant switching
   - Test browser back button
   - Test tab close

2. **Update TabAssistant** (WhatsApp)
   - Apply same navigation guard pattern
   - Test WhatsApp-specific flows

3. **Test edge cases**
   - Save → navigate (should allow)
   - Edit → navigate → cancel (should stay)
   - Edit → navigate → confirm (should navigate)
   - Browser refresh (should warn)

**Validation**: No data loss from accidental navigation

### Phase 5: Accessibility Audit (Week 4)

**Goal**: Ensure WCAG 2.1 AA compliance

1. **Add focus management**
   - Enhance focus indicators
   - Test keyboard navigation
   - Verify focus on first error

2. **Add ARIA attributes**
   - Audit all form fields
   - Add missing aria-labels
   - Test with screen reader (NVDA/VoiceOver)

3. **Test with assistive tech**
   - Screen reader testing (both forms)
   - Keyboard-only testing
   - High contrast mode testing

**Validation**: Passes WCAG 2.1 AA automated + manual tests

### Phase 6: Responsive Design (Week 4-5)

**Goal**: Optimize for mobile and tablet

1. **Update Voice assistant layout**
   - Add responsive classes
   - Test on mobile viewport (375px)
   - Test on tablet viewport (768px)
   - Test on desktop (1280px+)

2. **Update WhatsApp assistant layout**
   - Apply responsive patterns
   - Test same viewports

3. **Test touch interactions**
   - Verify 44px touch targets
   - Test tooltips on touch devices
   - Test slider on touch

4. **Test in real devices**
   - iOS Safari
   - Android Chrome
   - Tablet (iPad/Android)

**Validation**: Forms usable on all device sizes

### Phase 7: Final Testing & Optimization (Week 5)

**Goal**: Polish and optimize performance

1. **Performance testing**
   - Measure form render time
   - Optimize validation debouncing
   - Test with large datasets

2. **Cross-browser testing**
   - Chrome, Firefox, Safari, Edge
   - Dark mode in all browsers
   - Mobile browsers

3. **E2E testing** (if Playwright available)
   - Create assistant → edit → save
   - Edit → navigate → discard changes
   - Edit → navigate → cancel
   - Validation error flows

4. **User acceptance testing**
   - Test with actual users
   - Gather feedback
   - Iterate on UX issues

**Validation**: Ready for production deployment

### Rollback Plan

**If issues arise at any phase**:

1. **Validation schemas** (Phase 1)
   - Remove schema imports
   - Keep old validation logic
   - No user-facing impact

2. **Form migration** (Phase 2-3)
   - Revert to old useState pattern
   - Keep validation schemas for future
   - Forms remain functional

3. **Navigation guards** (Phase 4)
   - Remove guard components
   - Users may lose unsaved changes (pre-existing issue)
   - No form functionality broken

4. **Accessibility/Responsive** (Phase 5-6)
   - Revert CSS changes
   - Keep core form functionality
   - Progressive enhancement - works without these

**Key principle**: Each phase is additive, not destructive. Can stop at any point.

---

## Testing Recommendations

### Unit Tests (Jest + React Testing Library)

#### 1. **Validation Schema Tests**

```typescript
// /src/lib/schemas/__tests__/assistantValidation.test.ts
import { voiceAssistantSchema, whatsappAssistantSchema } from '../assistantValidation';

describe('voiceAssistantSchema', () => {
  it('should accept valid voice assistant data', () => {
    const validData = {
      prompt: 'This is a valid prompt with enough characters',
      temperature: 0.7,
      maxTokens: 150,
      welcomeMessage: 'Welcome!',
      endCallMessage: 'Goodbye!',
      voicemailMessage: 'Leave a message',
      endCallPhrases: ['Thank you', 'Goodbye'],
      recordCall: true,
      detectEmotion: false,
      backgroundOffice: true,
    };

    expect(() => voiceAssistantSchema.parse(validData)).not.toThrow();
  });

  it('should reject prompt with less than 20 characters', () => {
    const invalidData = {
      prompt: 'Short prompt', // Only 12 characters
      temperature: 0.7,
      maxTokens: 150,
      // ... other required fields
    };

    expect(() => voiceAssistantSchema.parse(invalidData)).toThrow();
  });

  it('should reject temperature outside 0-2 range', () => {
    const invalidData = {
      temperature: 2.5, // Too high
      // ... other fields
    };

    expect(() => voiceAssistantSchema.parse(invalidData)).toThrow();
  });
});

describe('whatsappAssistantSchema', () => {
  it('should accept valid WhatsApp transfer number', () => {
    const validData = {
      numberTransfer: '11234567890', // 11 digits
      // ... other fields
    };

    expect(() => whatsappAssistantSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid transfer number format', () => {
    const invalidData = {
      numberTransfer: '+1-123-456-7890', // Contains symbols
      // ... other fields
    };

    expect(() => whatsappAssistantSchema.parse(invalidData)).toThrow();
  });
});
```

#### 2. **UnsavedChangesDialog Component Tests**

```typescript
// /src/components/intelliaa/assistants/common/__tests__/UnsavedChangesDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dialog when open', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('¿Descartar cambios sin guardar?')).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    render(
      <UnsavedChangesDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText('¿Descartar cambios sin guardar?')).not.toBeInTheDocument();
  });

  it('should call onConfirm when Descartar button clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Descartar'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Cancelar button clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
```

#### 3. **Form Skeleton Tests**

```typescript
// /src/components/intelliaa/assistants/common/__tests__/FormSkeletons.test.tsx
import { render, screen } from '@testing-library/react';
import { VoiceAssistantFormSkeleton, WhatsAppAssistantFormSkeleton } from '../FormSkeletons';

describe('VoiceAssistantFormSkeleton', () => {
  it('should render skeleton structure', () => {
    const { container } = render(<VoiceAssistantFormSkeleton />);

    // Check for skeleton elements
    const skeletons = container.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('WhatsAppAssistantFormSkeleton', () => {
  it('should render skeleton structure', () => {
    const { container } = render(<WhatsAppAssistantFormSkeleton />);

    const skeletons = container.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

#### 4. **AssistantSettings Form Tests**

```typescript
// /src/components/intelliaa/assistants/voice/__tests__/AssistantSettings.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantSettings } from '../AssistantSettings';
import { mockAssistant } from '@/test/fixtures/assistants';

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('AssistantSettings', () => {
  it('should display validation error for short prompt', async () => {
    render(<AssistantSettings assistant={mockAssistant} />);

    const promptField = screen.getByPlaceholderText('Prompt');

    // Clear field and enter short text
    await userEvent.clear(promptField);
    await userEvent.type(promptField, 'Short'); // Less than 20 chars

    // Blur to trigger validation
    fireEvent.blur(promptField);

    await waitFor(() => {
      expect(screen.getByText(/El prompt debe tener al menos 20 caracteres/i)).toBeInTheDocument();
    });
  });

  it('should disable save button when no changes made', () => {
    render(<AssistantSettings assistant={mockAssistant} />);

    const saveButton = screen.getByRole('button', { name: /Guardar/i });
    expect(saveButton).toBeDisabled();
  });

  it('should enable save button when changes made', async () => {
    render(<AssistantSettings assistant={mockAssistant} />);

    const promptField = screen.getByPlaceholderText('Prompt');
    await userEvent.type(promptField, ' Additional text to make changes');

    const saveButton = screen.getByRole('button', { name: /Guardar/i });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('should call save handler with valid data', async () => {
    const mockSave = jest.fn();
    render(
      <AssistantSettings
        assistant={mockAssistant}
        handleSaveAssistant={mockSave}
      />
    );

    // Make valid changes
    const promptField = screen.getByPlaceholderText('Prompt');
    await userEvent.clear(promptField);
    await userEvent.type(promptField, 'This is a valid prompt with enough characters to pass validation');

    const saveButton = screen.getByRole('button', { name: /Guardar/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
```

### E2E Tests (Playwright)

#### 5. **Complete Form Flow Tests**

```typescript
// /e2e/assistant-configuration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Assistant Configuration Editing', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to assistant detail
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/assistants');

    // Click first assistant
    await page.click('[data-testid="assistant-item"]:first-child');
  });

  test('should show skeleton while loading', async ({ page }) => {
    // Skeleton should appear briefly
    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({ timeout: 1000 });
  });

  test('should edit and save assistant configuration', async ({ page }) => {
    // Wait for form to load
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible();

    // Edit prompt
    await page.fill('textarea[name="prompt"]', 'Updated prompt for testing with enough characters');

    // Verify save button is enabled
    await expect(page.locator('button:has-text("Guardar")')).toBeEnabled();

    // Click save
    await page.click('button:has-text("Guardar")');

    // Verify success toast
    await expect(page.locator('text=Asistente actualizado')).toBeVisible();
  });

  test('should show validation error for invalid prompt', async ({ page }) => {
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible();

    // Enter short prompt
    await page.fill('textarea[name="prompt"]', 'Short');
    await page.blur('textarea[name="prompt"]');

    // Verify error message
    await expect(page.locator('text=/El prompt debe tener al menos 20 caracteres/i')).toBeVisible();
  });

  test('should show unsaved changes dialog', async ({ page }) => {
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible();

    // Make changes
    await page.fill('textarea[name="prompt"]', 'Changed prompt that is long enough to be valid');

    // Try to navigate away (click another assistant)
    await page.click('[data-testid="assistant-item"]:nth-child(2)');

    // Verify dialog appears
    await expect(page.locator('text=¿Descartar cambios sin guardar?')).toBeVisible();
  });

  test('should discard changes when confirmed', async ({ page }) => {
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible();

    const originalPrompt = await page.inputValue('textarea[name="prompt"]');

    // Make changes
    await page.fill('textarea[name="prompt"]', 'New prompt that will be discarded but is valid length');

    // Try to navigate away
    await page.click('[data-testid="assistant-item"]:nth-child(2)');

    // Confirm discard
    await page.click('button:has-text("Descartar")');

    // Verify navigation happened
    await page.waitForURL('**/assistants/*');
  });

  test('should cancel navigation when cancelled', async ({ page }) => {
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible();

    // Make changes
    await page.fill('textarea[name="prompt"]', 'Changed prompt with sufficient characters');

    // Try to navigate away
    await page.click('[data-testid="assistant-item"]:nth-child(2)');

    // Cancel
    await page.click('button:has-text("Cancelar")');

    // Verify still on same page with changes intact
    await expect(page.locator('textarea[name="prompt"]')).toHaveValue('Changed prompt with sufficient characters');
  });
});
```

### Accessibility Tests

#### 6. **Axe Core Accessibility Tests**

```typescript
// /src/components/intelliaa/assistants/voice/__tests__/AssistantSettings.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AssistantSettings } from '../AssistantSettings';
import { mockAssistant } from '@/test/fixtures/assistants';

expect.extend(toHaveNoViolations);

describe('AssistantSettings Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<AssistantSettings assistant={mockAssistant} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels on form fields', () => {
    const { getByLabelText } = render(<AssistantSettings assistant={mockAssistant} />);

    expect(getByLabelText(/Prompt/i)).toBeInTheDocument();
    expect(getByLabelText(/Temperatura/i)).toBeInTheDocument();
    expect(getByLabelText(/Máximo de tokens/i)).toBeInTheDocument();
  });

  it('should have keyboard accessible tooltips', async () => {
    const { getAllByRole } = render(<AssistantSettings assistant={mockAssistant} />);

    // Find all tooltip triggers
    const helpButtons = getAllByRole('button', { name: /help/i });

    // Should be able to focus and activate with keyboard
    helpButtons[0].focus();
    expect(document.activeElement).toBe(helpButtons[0]);
  });
});
```

### Visual Regression Tests (Optional - using Percy or Chromatic)

```typescript
// /src/components/intelliaa/assistants/voice/__tests__/AssistantSettings.visual.test.tsx
import { render } from '@testing-library/react';
import percySnapshot from '@percy/playwright';
import { AssistantSettings } from '../AssistantSettings';
import { mockAssistant } from '@/test/fixtures/assistants';

describe('AssistantSettings Visual Regression', () => {
  it('should match screenshot in light mode', async () => {
    render(<AssistantSettings assistant={mockAssistant} />);
    await percySnapshot('AssistantSettings - Light Mode');
  });

  it('should match screenshot in dark mode', async () => {
    document.documentElement.classList.add('dark');
    render(<AssistantSettings assistant={mockAssistant} />);
    await percySnapshot('AssistantSettings - Dark Mode');
  });

  it('should match screenshot with validation errors', async () => {
    render(<AssistantSettings assistant={{...mockAssistant, prompt: 'Short'}} />);
    // Trigger validation
    await percySnapshot('AssistantSettings - With Errors');
  });

  it('should match screenshot on mobile viewport', async () => {
    // Set mobile viewport
    window.innerWidth = 375;
    window.innerHeight = 667;
    render(<AssistantSettings assistant={mockAssistant} />);
    await percySnapshot('AssistantSettings - Mobile');
  });
});
```

### Test Coverage Goals

- **Unit tests**: 80%+ coverage for validation schemas and utility functions
- **Integration tests**: All form interactions (input, validation, submission)
- **E2E tests**: Critical user paths (edit → save, edit → discard)
- **Accessibility tests**: Zero axe violations, keyboard navigation verified
- **Visual regression**: Prevent unintended UI changes

---

## Troubleshooting

### Common Issues and Solutions

#### 1. **Form doesn't reset when switching assistants**

**Symptom**: Old assistant's data persists when selecting new assistant

**Cause**: React Hook Form doesn't auto-reset on prop changes

**Solution**:
```typescript
useEffect(() => {
  form.reset({
    prompt: assistant.prompt,
    temperature: assistant.temperature,
    // ... all fields
  });
}, [assistant.id, form]); // Reset when assistant changes
```

**Alternative**: Use `key` prop to force remount
```typescript
<AssistantSettings
  key={assistant.id}
  assistant={assistant}
/>
```

---

#### 2. **Validation errors don't clear after fixing input**

**Symptom**: Error message persists even after entering valid value

**Cause**: Form validation mode set to `onSubmit`

**Solution**: Change validation mode
```typescript
const form = useForm({
  resolver: zodResolver(schema),
  mode: "onBlur", // Validate on blur
  reValidateMode: "onChange", // Re-validate on change after first error
});
```

---

#### 3. **Toast notifications don't appear**

**Symptom**: `toast()` called but nothing visible

**Cause**: `<Toaster />` not mounted in component tree

**Solution**: Verify Toaster in layout
```typescript
// In root layout or _app.tsx
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster /> {/* Must be here */}
      </body>
    </html>
  );
}
```

---

#### 4. **Unsaved changes dialog appears even after saving**

**Symptom**: Dialog shows despite successful save

**Cause**: Form dirty state not reset after save

**Solution**: Call `form.reset()` after successful save
```typescript
const handleSaveAssistant = async (data) => {
  await saveToApi(data);
  form.reset(data); // Reset with saved values to clear dirty state
};
```

---

#### 5. **Slider value doesn't update visually**

**Symptom**: Slider thumb doesn't move when changing value programmatically

**Cause**: Controlled component not receiving updated value

**Solution**: Ensure value prop is updated
```typescript
<FormField
  control={form.control}
  name="temperature"
  render={({ field }) => (
    <Slider
      value={[field.value]} // Must be array
      onValueChange={([value]) => field.onChange(value)} // Extract from array
      {...otherProps}
    />
  )}
/>
```

---

#### 6. **Skeleton flickers on fast connections**

**Symptom**: Skeleton appears and disappears rapidly

**Cause**: Data loads too quickly

**Solution**: Add minimum display time
```typescript
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const loadData = async () => {
    const start = Date.now();
    const data = await fetchAssistant();

    const elapsed = Date.now() - start;
    const minDisplayTime = 300; // 300ms minimum

    if (elapsed < minDisplayTime) {
      await new Promise(resolve =>
        setTimeout(resolve, minDisplayTime - elapsed)
      );
    }

    setAssistant(data);
    setIsLoading(false);
  };

  loadData();
}, []);
```

---

#### 7. **TypeScript errors with FormField render prop**

**Symptom**: `field` type is `any` or has type errors

**Cause**: Generic type not inferred correctly

**Solution**: Explicitly type the field
```typescript
<FormField<VoiceAssistantFormData>
  control={form.control}
  name="prompt"
  render={({ field }: { field: ControllerRenderProps<VoiceAssistantFormData, "prompt"> }) => (
    // field is now properly typed
  )}
/>
```

**Better solution**: Let TypeScript infer from schema
```typescript
const form = useForm<VoiceAssistantFormData>({
  resolver: zodResolver(voiceAssistantSchema),
});

// TypeScript now knows field types automatically
<FormField
  control={form.control}
  name="prompt" // Autocomplete works!
  render={({ field }) => <Textarea {...field} />}
/>
```

---

#### 8. **Dark mode form looks broken**

**Symptom**: Form barely visible or wrong colors in dark mode

**Cause**: Custom class overriding theme variables

**Solution**: Use theme variables instead of hard-coded colors
```typescript
// BAD
<Card className="bg-white text-black">

// GOOD
<Card className="bg-card text-card-foreground">
```

**Verify theme classes**:
- `bg-background` / `text-foreground`
- `bg-card` / `text-card-foreground`
- `bg-primary` / `text-primary-foreground`
- `border-border`

---

#### 9. **Browser shows "Leave site?" when no changes made**

**Symptom**: `beforeunload` dialog appears incorrectly

**Cause**: `isDirty` state not properly tracked

**Solution**: Verify form reset after successful save
```typescript
// After save
form.reset(newData, { keepDefaultValues: false });

// Check dirty state
console.log('Is dirty:', form.formState.isDirty); // Should be false
```

---

#### 10. **Mobile keyboard covers input fields**

**Symptom**: On mobile, keyboard hides focused input

**Cause**: Viewport not adjusting for keyboard

**Solution**: Ensure proper viewport meta tag + scroll into view
```html
<!-- In layout head -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

```typescript
// In Input component or form
<Input
  onFocus={(e) => {
    // Scroll input into view on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // Wait for keyboard to open
    }
  }}
  {...field}
/>
```

---

#### 11. **Zod validation too slow on large forms**

**Symptom**: Typing feels laggy, validation slows down UI

**Cause**: Validation running on every keystroke

**Solution**: Debounce validation
```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedValidate = useDebouncedCallback(
  (field: keyof VoiceAssistantFormData) => {
    form.trigger(field); // Trigger validation
  },
  500 // 500ms delay
);

<FormField
  render={({ field }) => (
    <Input
      {...field}
      onChange={(e) => {
        field.onChange(e); // Update value immediately
        debouncedValidate(field.name); // Validate after delay
      }}
    />
  )}
/>
```

**Alternative**: Change validation mode
```typescript
const form = useForm({
  mode: "onBlur", // Only validate when field loses focus
});
```

---

#### 12. **ARIA errors in browser console**

**Symptom**: `aria-describedby` references non-existent ID

**Cause**: FormMessage not rendered when no error

**Solution**: Already handled by shadcn/ui FormControl - verify structure
```typescript
// CORRECT structure
<FormField
  render={({ field }) => (
    <FormItem>
      <FormLabel>Field</FormLabel>
      <FormControl> {/* This handles ARIA attributes */}
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Renders conditionally */}
    </FormItem>
  )}
/>
```

**If still seeing errors**, check browser DevTools Elements panel:
- Verify `aria-describedby` IDs exist in DOM
- Ensure FormItem wraps all form field components

---

### Debugging Tips

#### 1. **React DevTools**
- Install React DevTools browser extension
- Inspect form state: `_reactInternalInstance.memoizedState`
- Check `formState.isDirty`, `formState.errors`

#### 2. **Form State Logging**
```typescript
const form = useForm<VoiceAssistantFormData>({
  resolver: zodResolver(voiceAssistantSchema),
});

// Log all form state changes
useEffect(() => {
  console.log('Form State:', {
    isDirty: form.formState.isDirty,
    isValid: form.formState.isValid,
    errors: form.formState.errors,
    touchedFields: form.formState.touchedFields,
  });
}, [form.formState]);
```

#### 3. **Zod Schema Debugging**
```typescript
// Test schema in isolation
const result = voiceAssistantSchema.safeParse(testData);
if (!result.success) {
  console.log('Validation errors:', result.error.format());
}
```

#### 4. **Network Inspector**
- Check Network tab for API calls
- Verify request payload matches expected format
- Check response status and error messages

#### 5. **Accessibility Inspector**
- Use browser Accessibility Tree (DevTools > Accessibility)
- Verify ARIA attributes in Elements panel
- Use axe DevTools extension for automated checks

---

## Final Checklist Before Deployment

### Functionality
- [ ] Voice assistant form saves correctly to Supabase
- [ ] Voice assistant form saves correctly to VAPI
- [ ] WhatsApp assistant form saves correctly to Supabase
- [ ] Document storage assignment works
- [ ] Validation errors display inline
- [ ] Toast notifications appear on save/error
- [ ] Unsaved changes dialog works (browser nav)
- [ ] Unsaved changes dialog works (in-app nav)
- [ ] Form resets when switching assistants
- [ ] Skeleton displays on initial load

### Accessibility
- [ ] All form fields have labels
- [ ] Tab navigation works logically
- [ ] Focus indicators visible
- [ ] Screen reader announces errors
- [ ] Keyboard shortcuts work (Ctrl+S save)
- [ ] No axe accessibility violations
- [ ] Tooltips accessible via keyboard
- [ ] Loading states announced

### Responsive Design
- [ ] Form usable on 375px width (mobile)
- [ ] Form usable on 768px width (tablet)
- [ ] Form usable on 1280px+ width (desktop)
- [ ] Touch targets minimum 44px
- [ ] Buttons stack on mobile
- [ ] Tooltips don't overflow viewport
- [ ] No horizontal scroll

### Theme Support
- [ ] Light mode displays correctly
- [ ] Dark mode displays correctly
- [ ] No hydration mismatches
- [ ] Theme toggle doesn't break layout
- [ ] Custom dark shadows work
- [ ] Error states visible in both themes

### Performance
- [ ] Form renders in < 100ms
- [ ] Validation doesn't cause lag
- [ ] Skeleton shows for minimum 300ms
- [ ] No unnecessary re-renders
- [ ] Toast animations smooth
- [ ] Dialog animations smooth

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS 15+)
- [ ] Mobile Chrome (Android 12+)

### Data Integrity
- [ ] No data loss on navigation
- [ ] Disabled fields stay disabled (WhatsApp keyword)
- [ ] Number validation prevents invalid formats
- [ ] Temperature constrained to 0-2 range
- [ ] Max tokens constrained to 50-4000
- [ ] End call phrases limited to 20

### Error Handling
- [ ] API failures show error toast
- [ ] Network errors handled gracefully
- [ ] Validation errors clear on fix
- [ ] Failed saves don't clear form
- [ ] Console errors handled and logged

---

## Conclusion

This implementation plan provides a comprehensive roadmap to enhance the assistant configuration editing UI with:

1. **Robust validation** via React Hook Form + Zod
2. **Data loss prevention** via unsaved changes dialogs
3. **Better loading states** via skeleton screens
4. **Accessibility compliance** via ARIA and focus management
5. **Responsive design** via mobile-first approach
6. **Theme consistency** via CSS variables

**Key Strengths**:
- All necessary shadcn/ui components already installed
- React Hook Form and Zod already in project dependencies
- Existing theme system well-designed
- Incremental migration path allows safe deployment

**Next Steps**:
1. Review this plan with development team
2. Begin Phase 1 (Foundation) implementation
3. Test each phase thoroughly before proceeding
4. Gather user feedback during UAT
5. Deploy to production after all phases complete

**Estimated Timeline**: 4-5 weeks for complete implementation
**Risk Level**: Low - existing functionality preserved throughout migration
