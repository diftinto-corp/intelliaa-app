# shadcn/ui Implementation Plan: Document Storage Deletion UI

## Overview
Comprehensive UI/UX design for document storage deletion with validation, multi-state management, and graceful degradation feedback. This implementation focuses on creating a safe, informative, and accessible deletion experience.

## Component Architecture

### High-Level Structure
```
DocumentViewer (Client Component)
  └── DeleteDocumentStorageButton (New Component - Recommended)
       ├── Button (Trigger)
       └── AlertDialog (Confirmation)
            ├── AlertDialogHeader
            │    ├── AlertDialogTitle
            │    └── AlertDialogDescription
            ├── AssignmentWarning (Conditional - if assigned)
            │    ├── Alert (warning variant)
            │    └── Badge[] (assigned assistants)
            ├── DeletionProgress (Conditional - during deletion)
            │    └── Progress (optional visual feedback)
            └── AlertDialogFooter
                 ├── AlertDialogCancel
                 └── AlertDialogAction (Eliminar button)
```

## Critical Decision: AlertDialog vs Dialog

### Recommendation: Use AlertDialog

**Rationale:**
1. **Semantic Correctness**: AlertDialog is specifically designed for critical confirmations
2. **Accessibility**: Built-in ARIA patterns for alerts (`role="alertdialog"`)
3. **Focus Management**: Automatic focus trap and restoration
4. **User Expectation**: AlertDialog communicates urgency and importance
5. **Keyboard Navigation**: ESC to cancel is standard behavior

**AlertDialog Advantages:**
- WCAG 2.1 AA compliant out of the box
- Screen reader announces as "alert dialog"
- Cannot be dismissed by clicking overlay (must use buttons)
- Simpler API for destructive actions

**Dialog Disadvantages for this use case:**
- Too generic, doesn't convey urgency
- Allows dismissal by clicking outside
- Requires manual ARIA role management

## File Changes

### Files to Modify

#### 1. `/src/components/intelliaa/assistants/documents/documentViewer/document-viewer.tsx`

**Changes Required:**
- Replace Dialog with AlertDialog
- Add assignment validation before opening dialog
- Implement multi-state management (idle, validating, deleting, blocked, error)
- Add comprehensive error handling UI
- Improve loading states with descriptive messages

**Key Modifications:**
```typescript
// Current imports to modify
import {
  Dialog,          // REMOVE
  DialogContent,   // REMOVE
  // ... other Dialog imports
} from "@/components/ui/dialog";

// New imports to add
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
```

### Files to Create

#### 2. `/src/components/intelliaa/documents/delete-document-storage-dialog.tsx` (RECOMMENDED)

**Purpose:** Isolated, reusable component for deletion confirmation
**Component type:** Client Component
**Key dependencies:**
- @radix-ui/react-alert-dialog (via shadcn AlertDialog)
- TailwindCSS utilities
- Next.js 15 hooks (useState, useCallback)

**Code Structure:**
```typescript
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, Loader2, Trash2, AlertTriangle } from "lucide-react";

// Type definitions
type DeletionState = "idle" | "validating" | "deleting" | "blocked" | "success" | "error";

interface AssignedAssistant {
  id: string;
  name: string;
  namespace: string;
}

interface DeletionResult {
  success: boolean;
  warnings?: string[];
  error?: string;
}

interface DeleteDocumentStorageDialogProps {
  documentStorageId: string;
  documentStorageName: string;
  documentCount: number;
  qaCount: number;
  accountSlug: string;
  onDelete: (id: string) => Promise<DeletionResult>;
  onValidateAssignments: (id: string) => Promise<AssignedAssistant[]>;
}

export function DeleteDocumentStorageDialog({
  documentStorageId,
  documentStorageName,
  documentCount,
  qaCount,
  accountSlug,
  onDelete,
  onValidateAssignments,
}: DeleteDocumentStorageDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State management
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DeletionState>("idle");
  const [assignedAssistants, setAssignedAssistants] = useState<AssignedAssistant[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation handler (runs when dialog opens)
  const handleOpenChange = useCallback(async (isOpen: boolean) => {
    if (isOpen) {
      setState("validating");
      setOpen(true);
      setErrorMessage(null);

      try {
        const assistants = await onValidateAssignments(documentStorageId);
        if (assistants.length > 0) {
          setState("blocked");
          setAssignedAssistants(assistants);
        } else {
          setState("idle");
        }
      } catch (error) {
        setState("error");
        setErrorMessage("Error al validar asignaciones. Por favor, intente nuevamente.");
      }
    } else {
      setOpen(false);
      // Reset state after close animation
      setTimeout(() => {
        setState("idle");
        setAssignedAssistants([]);
        setErrorMessage(null);
      }, 200);
    }
  }, [documentStorageId, onValidateAssignments]);

  // Deletion handler
  const handleDelete = useCallback(async () => {
    setState("deleting");
    setErrorMessage(null);

    try {
      const result = await onDelete(documentStorageId);

      if (result.success) {
        setState("success");

        // Show success toast with warnings if any
        if (result.warnings && result.warnings.length > 0) {
          toast({
            title: "Almacenamiento eliminado con advertencias",
            description: (
              <div className="mt-2 space-y-1">
                <p>El almacenamiento fue eliminado, pero algunos servicios externos fallaron:</p>
                <ul className="list-disc list-inside text-sm">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            ),
            variant: "default",
          });
        } else {
          toast({
            title: "Almacenamiento eliminado",
            description: "El almacenamiento de documentos ha sido eliminado correctamente.",
            variant: "default",
          });
        }

        // Close dialog and redirect
        setOpen(false);
        setTimeout(() => {
          router.push(`/${accountSlug}/documents`);
        }, 100);
      } else {
        setState("error");
        setErrorMessage(result.error || "Error desconocido al eliminar el almacenamiento.");

        toast({
          title: "Error al eliminar",
          description: result.error || "No se pudo eliminar el almacenamiento de documentos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setState("error");
      const message = error instanceof Error ? error.message : "Error desconocido";
      setErrorMessage(message);

      toast({
        title: "Error crítico",
        description: "Ocurrió un error inesperado. Por favor, contacte al soporte.",
        variant: "destructive",
      });
    }
  }, [documentStorageId, onDelete, accountSlug, router, toast]);

  // Derived state for UI rendering
  const isLoading = state === "validating" || state === "deleting";
  const isBlocked = state === "blocked";
  const canDelete = state === "idle" && !isLoading && !isBlocked;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="destructive"
          disabled={isLoading}
          aria-label="Eliminar almacenamiento de documentos"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            ¿Eliminar almacenamiento de documentos?
          </AlertDialogTitle>

          <AlertDialogDescription className="text-left space-y-3">
            {/* Validation loading state */}
            {state === "validating" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validando asignaciones...</span>
              </div>
            )}

            {/* Normal description */}
            {(state === "idle" || state === "deleting") && (
              <>
                <p className="font-medium text-foreground">
                  {documentStorageName}
                </p>
                <p>
                  Esta acción es permanente y eliminará:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                  <li>{documentCount} {documentCount === 1 ? 'documento PDF' : 'documentos PDF'}</li>
                  <li>{qaCount} {qaCount === 1 ? 'texto complementario' : 'textos complementarios'}</li>
                  <li>Embeddings vectoriales en Pinecone</li>
                  <li>Knowledge base en VAPI</li>
                </ul>
              </>
            )}

            {/* Assignment blocked warning */}
            {isBlocked && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No se puede eliminar</AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                  <p>
                    Este almacenamiento está asignado a los siguientes asistentes:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {assignedAssistants.map((assistant) => (
                      <Badge key={assistant.id} variant="secondary">
                        {assistant.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs mt-3">
                    Elimine las asignaciones antes de continuar.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message */}
            {state === "error" && errorMessage && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Deleting state */}
            {state === "deleting" && (
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Eliminando almacenamiento...</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esto puede tomar unos segundos
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={state === "deleting"}
            onClick={() => setOpen(false)}
          >
            {isBlocked ? "Entendido" : "Cancelar"}
          </AlertDialogCancel>

          {!isBlocked && (
            <AlertDialogAction
              disabled={!canDelete || state === "deleting"}
              onClick={(e) => {
                e.preventDefault(); // Prevent default close behavior
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {state === "deleting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## Configuration Updates

### No changes required to:
- `tailwind.config.ts` - Uses existing design tokens
- `globals.css` - All required CSS variables are present
- `components.json` - AlertDialog already installed

### Verify installed components:
```bash
# If Alert component is missing, install:
npx shadcn-ui@latest add alert

# If Badge component is missing, install:
npx shadcn-ui@latest add badge

# If Progress component is missing (optional), install:
npx shadcn-ui@latest add progress
```

## Integration Points

### 1. Document Viewer Component Integration

**File:** `/src/components/intelliaa/assistants/documents/documentViewer/document-viewer.tsx`

**Replace existing Dialog implementation (lines 107-142) with:**

```typescript
import { DeleteDocumentStorageDialog } from "@/components/intelliaa/documents/delete-document-storage-dialog";

// Inside the component:
<DeleteDocumentStorageDialog
  documentStorageId={documentStorageId}
  documentStorageName={documentStorageNamespace || "Almacenamiento sin nombre"}
  documentCount={documentsListPage.length}
  qaCount={qaCount} // Need to fetch this - see below
  accountSlug={accountSlug}
  onDelete={handleDeleteDocument}
  onValidateAssignments={handleValidateAssignments}
/>
```

### 2. Page Component Updates

**File:** `/src/app/[accountSlug]/documents/[document-storage-id]/page.tsx`

**Add validation function:**
```typescript
// Add state for QA count
const [qaCount, setQaCount] = useState(0);

// Fetch QA count in useEffect
useEffect(() => {
  const fetchQACount = async () => {
    // TODO: Create getQACountForDocumentStorage function
    const count = await getQACountForDocumentStorage(documentStorageId);
    setQaCount(count);
  };
  fetchQACount();
}, [documentStorageId]);

// Add validation handler
const handleValidateAssignments = async (documentStorageId: string) => {
  try {
    const { data, error } = await supabase
      .from("document_storage-assistants")
      .select(`
        assistant_id,
        assistants (
          id,
          name,
          namespace
        )
      `)
      .eq("document_storage_id", documentStorageId);

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.assistants.id,
      name: item.assistants.name,
      namespace: item.assistants.namespace,
    }));
  } catch (error) {
    console.error("Error validating assignments:", error);
    throw error;
  }
};

// Update handleDeleteDocument to return DeletionResult
const handleDeleteDocument = async (documentId: string): Promise<DeletionResult> => {
  try {
    setDeleteError(null);
    setIsDeleting(true);

    const result = await deleteAllDocumentStorageById(documentId);

    return {
      success: true,
      warnings: result.warnings || [],
    };
  } catch (error) {
    console.error("Delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  } finally {
    setIsDeleting(false);
  }
};
```

### 3. Server Action Updates

**File:** `/src/lib/actions/intelliaa/documents.ts`

**Update `deleteAllDocumentStorageById` to return structured result:**
```typescript
export async function deleteAllDocumentStorageById(
  documentStorageId: string
): Promise<{ success: boolean; warnings?: string[]; error?: string }> {
  const warnings: string[] = [];

  try {
    // 1. Validate assignments
    const assignments = await checkDocumentStorageAssignments(documentStorageId);
    if (assignments.length > 0) {
      return {
        success: false,
        error: `Asignado a ${assignments.length} asistente${assignments.length > 1 ? 's' : ''}`,
      };
    }

    // 2. Get document storage details
    const documentStorage = await getDocumentStorageById(documentStorageId);
    if (!documentStorage || documentStorage.length === 0) {
      return { success: false, error: "Almacenamiento no encontrado" };
    }

    const namespace = documentStorage[0].namespace;

    // 3. Delete VAPI files (graceful degradation)
    try {
      await deleteVAPIFiles(documentStorageId);
    } catch (error) {
      warnings.push("VAPI files: Fallo al eliminar archivos");
      console.error("VAPI files deletion failed:", error);
    }

    // 4. Delete VAPI knowledge base (graceful degradation)
    try {
      await deleteVAPIKnowledgeBase(namespace);
    } catch (error) {
      warnings.push("VAPI KB: Fallo al eliminar knowledge base");
      console.error("VAPI KB deletion failed:", error);
    }

    // 5. Delete Pinecone namespace (graceful degradation)
    try {
      await deletePineconeNamespace(namespace);
    } catch (error) {
      warnings.push("Pinecone: Fallo al eliminar vectores");
      console.error("Pinecone deletion failed:", error);
    }

    // 6. Delete database records (critical - must succeed)
    await deleteDocumentsByNamespace("pdf_docs", namespace);
    await deleteDocumentsByNamespace("qa_docs", namespace);
    await supabase
      .from("document_storages")
      .delete()
      .eq("id", documentStorageId);

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("Critical deletion error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error crítico de eliminación",
    };
  }
}
```

## Accessibility Considerations

### ARIA Patterns
- **AlertDialog**: Automatic `role="alertdialog"` from Radix UI
- **Focus Management**: Focus trapped in dialog, restored on close
- **Keyboard Navigation**:
  - ESC closes dialog (only when not deleting)
  - Tab cycles through interactive elements
  - Enter on Cancel button closes dialog
  - Enter on Delete button confirms deletion

### Screen Reader Support
- Dialog title announces as "Alert Dialog: ¿Eliminar almacenamiento de documentos?"
- Loading states announce changes: "Validando asignaciones...", "Eliminando almacenamiento..."
- Error messages are live regions (automatic with Alert component)
- Button states (disabled, loading) are announced

### Visual Accessibility
- Color contrast: All text meets WCAG AA standards
- Error states: Red color + icon (not color alone)
- Loading states: Animation + text label
- Focus indicators: Visible focus rings on all interactive elements

### Touch Targets
- Minimum 44x44px touch targets (Button size="icon" is 40x40, should be increased)
- Adequate spacing between Cancel and Delete buttons (8px gap)

**Recommendation:** Increase icon button size on mobile:
```typescript
<Button
  size="icon"
  variant="destructive"
  className="h-11 w-11 md:h-10 md:w-10" // Larger on mobile
  aria-label="Eliminar almacenamiento de documentos"
>
```

## Responsive Design Strategy

### Breakpoints
- **Mobile (< 640px)**:
  - Full-width dialog (sm:max-w-[500px] respects this)
  - Stack badges vertically if many assistants
  - Larger touch targets

- **Tablet (640px - 1024px)**:
  - Centered dialog with max-width 500px
  - Grid layout for badges (2 columns)

- **Desktop (> 1024px)**:
  - Centered dialog with max-width 500px
  - Grid layout for badges (3 columns)

### Mobile Optimizations
```typescript
// In DeleteDocumentStorageDialog component
<AlertDialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
  {/* Content scrolls if too tall on mobile */}
</AlertDialogContent>

// Badge layout
<div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
  {/* Scrollable if many assistants */}
  {assignedAssistants.map((assistant) => (
    <Badge key={assistant.id} variant="secondary" className="text-xs">
      {assistant.name}
    </Badge>
  ))}
</div>
```

### Safe Area Insets (iOS)
```typescript
// Add to AlertDialogContent
className="sm:max-w-[500px] pb-safe" // Tailwind safe area plugin
```

## Important Notes & Warnings

### Critical Breaking Changes
1. **AlertDialog API differs from Dialog**:
   - `AlertDialogAction` auto-closes on click - must use `e.preventDefault()`
   - Cannot dismiss by clicking overlay (feature, not bug)
   - Must handle open state manually for controlled behavior

2. **Next.js 15 Async Considerations**:
   - All server actions must be awaited
   - Cannot use `revalidatePath` in client components
   - Toast notifications are client-side only

3. **Hydration Safety**:
   - Dialog state must be client-side only
   - Do not conditionally render AlertDialog based on server data
   - Use `mounted` state if theme-dependent styling is needed

### Performance Implications
- **Validation on open**: May cause delay if many assignments
  - Consider caching assignment count on document storage record
  - Show loading spinner immediately on open

- **Deletion progress**: Long-running operation
  - Consider WebSocket or polling for real-time progress
  - Current implementation blocks UI during deletion

### Browser Compatibility
- **All modern browsers** supported via Radix UI
- **IE11**: Not supported (React 19 requirement)
- **Safari**: Requires `-webkit-` prefixes for some animations (handled by PostCSS)

## Migration Path

### Step 1: Install Missing Components
```bash
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add badge
```

### Step 2: Create New Component
Create `/src/components/intelliaa/documents/delete-document-storage-dialog.tsx` with full implementation above.

### Step 3: Update Document Viewer
Replace Dialog implementation with AlertDialog in `document-viewer.tsx`.

### Step 4: Update Page Component
Add validation handler and update deletion handler in page component.

### Step 5: Refactor Server Action
Update `deleteAllDocumentStorageById` to return structured result with warnings.

### Step 6: Testing
- Test assignment validation flow
- Test deletion with external service failures
- Test all error states
- Test keyboard navigation
- Test on mobile devices

## Testing Recommendations

### Functional Tests
- [ ] Delete unassigned document storage successfully
- [ ] Block deletion of assigned document storage
- [ ] Show correct assignment count and names
- [ ] Handle VAPI file deletion failure gracefully
- [ ] Handle Pinecone deletion failure gracefully
- [ ] Show warnings toast when services fail
- [ ] Redirect after successful deletion
- [ ] Prevent multiple deletion attempts

### UI/UX Tests
- [ ] Dialog opens with validation loading state
- [ ] Assignment badges display correctly
- [ ] Error messages are clear and actionable
- [ ] Loading states provide feedback during long operations
- [ ] Toast notifications appear and auto-dismiss
- [ ] Button states (disabled, loading) work correctly

### Accessibility Tests
- [ ] Screen reader announces dialog correctly
- [ ] Keyboard navigation works (Tab, ESC, Enter)
- [ ] Focus is trapped in dialog
- [ ] Focus returns to trigger on close
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets are at least 44x44px

### Edge Cases
- [ ] Network timeout during deletion
- [ ] User loses internet connection
- [ ] Document storage deleted by another user
- [ ] Very long assistant names
- [ ] Many assigned assistants (>10)
- [ ] Empty document storage (0 PDFs, 0 QAs)

## Troubleshooting

### Issue: Dialog doesn't open
**Cause:** State management conflict with parent component
**Solution:** Ensure `open` state is controlled only by `DeleteDocumentStorageDialog`

### Issue: Delete button remains disabled
**Cause:** State not resetting after error
**Solution:** Check `handleOpenChange` resets all state on close

### Issue: Toast doesn't appear
**Cause:** Toaster component not mounted in layout
**Solution:** Verify `<Toaster />` is in root layout

### Issue: Assignments not showing
**Cause:** Join query incorrect or RLS blocking
**Solution:** Check Supabase RLS policies for `document_storage-assistants` table

### Issue: External services fail silently
**Cause:** Try-catch swallowing errors
**Solution:** Verify warnings are collected and returned in result

### Issue: Slow validation
**Cause:** Multiple database queries
**Solution:** Add index on `document_storage_id` in junction table

## Design Token Reference

All colors use existing `globals.css` variables:

- **Destructive actions**: `bg-destructive text-destructive-foreground`
- **Warnings**: `text-yellow-600 dark:text-yellow-500` (consider adding to globals.css)
- **Errors**: `variant="destructive"` on Alert component
- **Loading states**: `text-muted-foreground` with spinner
- **Badges**: `variant="secondary"` for neutral appearance

## Next Steps for Implementation

1. Review this plan with team
2. Clarify server action response format requirements
3. Implement `getQACountForDocumentStorage` helper
4. Create database migration for assignment count denormalization (optional optimization)
5. Set up error tracking (Sentry) for external service failures
6. Create E2E tests for deletion flow
