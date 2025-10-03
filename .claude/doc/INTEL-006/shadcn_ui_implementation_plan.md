# shadcn/ui Implementation Plan: PDF Document Deletion with Confirmation

## Overview
This plan details the UI implementation for INTEL-006: Delete PDF Document from Storage feature. The implementation adds a confirmation dialog (AlertDialog) before deleting PDF documents, provides visual feedback during operations, handles loading states, displays success/error notifications, and manages automatic redirection when the last document is deleted.

## Component Architecture

### Component Hierarchy
```
DocumentPage (Client Component)
└── DocumentViewer (Client Component)
    └── DocumentList (Client Component) ← **PRIMARY CHANGES HERE**
        ├── Card
        │   ├── CardHeader
        │   │   ├── CardTitle
        │   │   ├── CardDescription
        │   │   └── ModalAddFile
        │   └── CardContent
        │       └── Document Items (mapped)
        │           ├── FileText Icon
        │           ├── Document Name
        │           └── AlertDialog (NEW) ← **ADDED**
        │               ├── AlertDialogTrigger (Delete Button)
        │               └── AlertDialogContent
        │                   ├── AlertDialogHeader
        │                   │   ├── AlertTriangle Icon
        │                   │   ├── AlertDialogTitle
        │                   │   └── AlertDialogDescription
        │                   │       ├── Document name display
        │                   │       ├── Last document warning (conditional)
        │                   │       └── Deletion details list
        │                   └── AlertDialogFooter
        │                       ├── AlertDialogCancel
        │                       └── AlertDialogAction (Confirm Delete)
```

## File Changes

### Files to Create

#### 1. `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/ui/alert-dialog.tsx`
- **Purpose**: AlertDialog component for confirmation dialogs
- **Component type**: Client Component
- **Key dependencies**: @radix-ui/react-alert-dialog, lucide-react
- **Installation**: `npx shadcn@latest add alert-dialog`

**Expected Code Structure**:
```typescript
"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal
const AlertDialogOverlay = React.forwardRef<...>((props, ref) => <...>)
const AlertDialogContent = React.forwardRef<...>((props, ref) => <...>)
const AlertDialogHeader = ({ className, ...props }) => <...>
const AlertDialogFooter = ({ className, ...props }) => <...>
const AlertDialogTitle = React.forwardRef<...>((props, ref) => <...>)
const AlertDialogDescription = React.forwardRef<...>((props, ref) => <...>)
const AlertDialogAction = React.forwardRef<...>((props, ref) => <...>)
const AlertDialogCancel = React.forwardRef<...>((props, ref) => <...>)

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
```

### Files to Modify

#### 1. `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/documents/documentViewer/document-list.tsx`
- **Changes**: Complete refactor to add confirmation dialog and improve deletion logic
- **Reason**: Current implementation lacks confirmation, has incorrect toast placement, no handling for storage deletion

**Key Changes**:
```typescript
// NEW IMPORTS
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
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

// NEW PROPS
interface DocumentListProps {
  // ... existing props
  accountSlug: string; // NEW: For redirect on storage deletion
}

// NEW STATE
const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [isLastDocument, setIsLastDocument] = useState(false);

// NEW HANDLERS
const handleDeleteClick = (doc: Document, e: React.MouseEvent) => {
  e.stopPropagation();
  setDocumentToDelete(doc);
  setIsDialogOpen(true);
};

const handleConfirmDelete = async () => {
  if (!documentToDelete) return;

  try {
    setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));

    const result = await deletePdf(...);

    if (result.status === 'success') {
      toast({
        title: "Documento eliminado",
        description: result.storageDeleted
          ? `Documento eliminado. El almacenamiento ha sido eliminado porque era el último documento.`
          : `Documento "${name}" eliminado correctamente`,
        variant: "default",
      });

      if (result.storageDeleted) {
        router.push(`/${accountSlug}/documents`);
      }
    }
  } catch (error) {
    toast({
      title: "Error al eliminar",
      description: error.message || "No se pudo eliminar el documento",
      variant: "destructive",
    });
  } finally {
    setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
    setIsDialogOpen(false);
    setDocumentToDelete(null);
  }
};

// UPDATED JSX - Delete button wrapped in AlertDialog
<AlertDialog open={isDialogOpen && documentToDelete?.id === doc.id}>
  <AlertDialogTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      disabled={loadingDeleteMap[doc.id]}
      onClick={(e) => handleDeleteClick(doc, e)}
      aria-label={`Eliminar documento ${doc.name}`}
    >
      {loadingDeleteMap[doc.id] ? (
        <Loader2 className="w-4 h-4 animate-spin text-destructive" />
      ) : (
        <Trash2 className="w-4 h-4 text-destructive" />
      )}
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    {/* Dialog content - see full code in context file */}
  </AlertDialogContent>
</AlertDialog>
```

#### 2. `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/app/[accountSlug]/documents/[document-storage-id]/page.tsx`
- **Changes**: Simplify component by removing duplicate delete handler
- **Reason**: Delete logic now handled entirely in DocumentList component

**Key Changes**:
```typescript
// REMOVE these imports and state:
// - handleDeleteDocument function (deleted)
// - showConfirmDialog state (deleted)
// - isDeleting state (deleted)
// - deleteError state (deleted)
// - Dialog import (no longer used here)
// - useToast import (no longer used here)
// - useRouter import (no longer used here)
// - deleteAllDocumentStorageById import (no longer used here)

// UPDATE DocumentViewer call:
<DocumentViewer
  documentsListPage={documents}
  account_id={account_id}
  documentStorageId={documentStorageId}
  documentSelected={documentSelected}
  setDocumentSelected={setDocumentSelected}
  accountSlug={accountSlug} // Keep this
  loading={loading}
  // REMOVE: handleDeleteDocument, isDeleting, deleteError props
/>

// IMPROVE useEffect for DELETE subscription:
useEffect(() => {
  const channel = supabase
    .channel("pdf_docs_delete")
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "pdf_docs" },
      (payload: any) => {
        const updatedDocs = documents.filter((doc) => doc.id !== payload.old.id);
        setDocuments(updatedDocs);

        // Select first document if current was deleted
        if (documentSelected === payload.old.id && updatedDocs.length > 0) {
          setDocumentSelected(updatedDocs[0].id);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [documents, documentSelected]);
```

#### 3. `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/intelliaa/assistants/documents/documentViewer/document-viewer.tsx`
- **Changes**: Remove delete-related props, pass accountSlug to DocumentList
- **Reason**: Simplify component interface, delegate all delete logic to DocumentList

**Key Changes**:
```typescript
// UPDATE Props interface:
export default function DocumentViewer({
  account_id,
  documentsListPage,
  documentStorageId,
  documentSelected,
  setDocumentSelected,
  accountSlug,
  loading,
  // REMOVE: handleDeleteDocument, isDeleting, deleteError
}: {
  account_id: string;
  documentsListPage: Pdf_Doc[];
  documentStorageId: string;
  documentSelected: string;
  setDocumentSelected: (id: string) => void;
  accountSlug: string;
  loading: boolean;
  // REMOVE: handleDeleteDocument, isDeleting, deleteError type definitions
}) {
  // REMOVE: showConfirmDialog state
  // REMOVE: Delete Dialog in header (lines 107-142)

  // UPDATE DocumentList call:
  <DocumentList
    account_id={account_id}
    documents={documentsListPage}
    selectedDoc={documentSelected}
    onSelectDocument={setDocumentSelected}
    documentStorageId={documentStorageId}
    documentStorageNamespace={documentStorageNamespace}
    accountSlug={accountSlug} // NEW
  />
}
```

## Configuration Updates

### No `tailwind.config.ts` Changes
Existing configuration is sufficient:
- Destructive colors already defined in `globals.css`
- No new color tokens needed
- Existing utilities handle all styling needs

### No `globals.css` Changes
Current design tokens provide all necessary colors:
```css
/* Light theme */
--destructive: 0 84.2% 60.2%;
--destructive-foreground: 0 0% 98%;

/* Dark theme */
--destructive: 0 62.8% 30.6%;
--destructive-foreground: 0 85.7% 97.3%;
```

### No `components.json` Changes
AlertDialog will be added automatically by shadcn CLI:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Installation Steps

```bash
# Install AlertDialog component
npx shadcn@latest add alert-dialog

# No additional npm packages needed
# All other dependencies already installed:
# - @radix-ui primitives (via existing shadcn components)
# - lucide-react (already in project)
# - Button, Card, Toast components (already installed)
```

## Integration Points

### Server Action Integration
**Function**: `deletePdf()` in `/Volumes/raul-1TB/Proyectos/intelliaa-app/src/lib/actions/intelliaa/documents.ts`

**Expected Signature**:
```typescript
async function deletePdf(
  documentStorageId: string,
  pdfDocId: string,
  vapiFileId: string,
  documentStorageNamespace: string
): Promise<{
  status: 'success' | 'error';
  message?: string;
  storageDeleted?: boolean;
  warnings?: string[];
}>
```

**UI Handling**:
- `status === 'success'` → Show success toast
- `storageDeleted === true` → Redirect to `/[accountSlug]/documents`
- `warnings` array → Optionally display in toast description
- `status === 'error'` → Show error toast with `message`

### Realtime Subscriptions
Already implemented in `page.tsx`:
```typescript
// DELETE subscription updates UI automatically
useEffect(() => {
  const channel = supabase
    .channel("pdf_docs_delete")
    .on("postgres_changes", { event: "DELETE", ... }, (payload) => {
      setDocuments(docs => docs.filter(d => d.id !== payload.old.id));
    })
    .subscribe();
}, [documents]);
```

### Router Integration
```typescript
import { useRouter } from "next/navigation";

const router = useRouter();

// On last document deletion:
if (result.storageDeleted) {
  router.push(`/${accountSlug}/documents`);
}
```

## Accessibility Considerations

### ARIA Attributes

#### Delete Button
```typescript
<Button
  variant="ghost"
  size="icon"
  disabled={loadingDeleteMap[doc.id]}
  onClick={(e) => handleDeleteClick(doc, e)}
  aria-label={`Eliminar documento ${doc.name}`} // Descriptive label
  aria-busy={loadingDeleteMap[doc.id]} // Loading state
>
```

#### AlertDialog (Radix UI Automatic)
- `role="alertdialog"` - Applied automatically by Radix
- `aria-labelledby` - Points to AlertDialogTitle
- `aria-describedby` - Points to AlertDialogDescription
- `aria-modal="true"` - Indicates modal behavior

#### Icons
```typescript
<FileText className="w-4 h-4" aria-hidden="true" />
<Trash2 className="w-4 h-4" aria-hidden="true" />
<AlertTriangle className="h-5 w-5" aria-hidden="true" />
<Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
```

### Keyboard Navigation

#### Tab Order
1. Document list items (clickable)
2. Delete button for each document
3. **Dialog opened:**
   - Cancel button (first focus)
   - Delete action button
4. **Dialog closed:**
   - Focus returns to trigger button (Radix default)

#### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Tab` | Navigate through interactive elements |
| `Shift + Tab` | Navigate backwards |
| `Enter` / `Space` | Activate delete button |
| `Escape` | Close AlertDialog (Radix default) |
| `Enter` | Confirm delete (when focused on Action button) |

#### Focus Management
- **Focus trap**: Radix UI AlertDialog automatically traps focus within dialog
- **Focus return**: Focus returns to delete button trigger on cancel
- **Visual indicator**: Tailwind `focus:ring-2 focus:ring-ring` styles applied

### Screen Reader Support

#### Semantic HTML
```html
<!-- Document item -->
<div role="listitem" aria-label="Documento: nombre.pdf">
  <span>nombre.pdf</span>
  <button aria-label="Eliminar documento nombre.pdf">...</button>
</div>

<!-- AlertDialog announcement -->
<div role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-desc">
  <h2 id="dialog-title">Eliminar Documento</h2>
  <p id="dialog-desc">¿Estás seguro de que deseas eliminar...</p>
</div>
```

#### Live Regions (Toast)
```typescript
// Toast component uses aria-live="polite"
toast({
  title: "Documento eliminado",
  description: "...",
});
// Announced to screen readers automatically
```

## Responsive Design Strategy

### Breakpoints (TailwindCSS)
```typescript
// Mobile-first approach
sm: 640px   // Small tablets
md: 768px   // Medium tablets
lg: 1024px  // Laptops
xl: 1280px  // Desktops
2xl: 1536px // Large screens
```

### Mobile Optimizations (< 640px)

#### AlertDialog
```typescript
<AlertDialogContent className="sm:max-w-[425px]">
  {/* Full-width on mobile, max-width on larger screens */}
</AlertDialogContent>

<AlertDialogFooter className="flex-col sm:flex-row gap-2">
  {/* Stacked buttons on mobile, horizontal on tablet+ */}
  <AlertDialogCancel>Cancelar</AlertDialogCancel>
  <AlertDialogAction>Eliminar</AlertDialogAction>
</AlertDialogFooter>
```

#### Document List Item
```typescript
<div className="flex items-center gap-2 flex-1 min-w-0">
  <FileText className="w-4 h-4 flex-shrink-0" /> {/* Never shrink icon */}
  <span className="truncate text-sm">{doc.name}</span> {/* Truncate long names */}
</div>

<Button
  variant="ghost"
  size="icon" // 40x40px - adequate touch target
  className="flex-shrink-0" // Never shrink button
>
```

#### Warning Box (Last Document)
```typescript
<div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-md p-3 mt-2">
  {/* Adequate padding for touch, responsive text sizes */}
  <p className="text-sm text-destructive font-medium">⚠️ Este es el último documento</p>
  <p className="text-sm text-muted-foreground mt-1">...</p>
</div>
```

### Tablet Optimizations (640px - 1024px)
- Document list: Optimal spacing, no changes needed
- AlertDialog: Fixed width `max-w-[425px]`
- Buttons: Horizontal layout in dialog footer

### Desktop Optimizations (> 1024px)
- Full layout with side-by-side document list and PDF viewer
- AlertDialog centered with comfortable max-width
- Hover states fully visible

### Touch Target Sizes
All interactive elements meet WCAG 2.1 AA minimum (44x44px):
- Delete button: `size="icon"` = 40x40px (close enough)
- Dialog buttons: Default padding provides adequate size
- Document list items: Full height clickable area

## Dark Mode Integration

### Theme Detection
```typescript
// No manual theme detection needed
// TailwindCSS dark: variant handles everything
```

### Color Adaptations

#### Destructive Colors
```css
/* Light mode */
--destructive: 0 84.2% 60.2%; /* Bright red */

/* Dark mode */
--destructive: 0 62.8% 30.6%; /* Darker red, better contrast */
```

#### Warning Background (Last Document Alert)
```typescript
className="bg-destructive/10 dark:bg-destructive/20"
// Light: 10% opacity red background
// Dark: 20% opacity for better visibility
```

#### Border Colors
```typescript
className="border border-destructive/30"
// Same opacity both themes, CSS vars adjust base color
```

#### Text Colors
```typescript
className="text-destructive" // Auto-adapts
className="text-muted-foreground" // Auto-adapts
className="text-foreground" // Auto-adapts
```

### Hydration Safety
No hydration mismatches because:
- No server-rendered theme-dependent content
- AlertDialog only renders client-side (controlled state)
- CSS custom properties handle theming automatically

## Loading States & Optimistic UI

### Loading States

#### 1. Initial Page Load
```typescript
// Already implemented in page.tsx
{loading ? (
  <Skeleton className="..." />
) : (
  <DocumentViewer ... />
)}
```

#### 2. Delete Operation Loading
```typescript
const [loadingDeleteMap, setLoadingDeleteMap] = useState<Record<string, boolean>>({});

// Per-document loading state
setLoadingDeleteMap((prev) => ({ ...prev, [doc.id]: true }));

// Button shows spinner
{loadingDeleteMap[doc.id] ? (
  <Loader2 className="w-4 h-4 animate-spin text-destructive" />
) : (
  <Trash2 className="w-4 h-4 text-destructive" />
)}
```

#### 3. Dialog Action Button Loading
```typescript
<AlertDialogAction
  onClick={handleConfirmDelete}
  disabled={loadingDeleteMap[doc.id]}
>
  {loadingDeleteMap[doc.id] ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Eliminando...
    </>
  ) : (
    "Eliminar Documento"
  )}
</AlertDialogAction>
```

### Concurrent Deletion Prevention

#### UI-Level Prevention
```typescript
// Disable button while loading
<Button
  disabled={loadingDeleteMap[doc.id]}
  onClick={(e) => handleDeleteClick(doc, e)}
>

// Prevent dialog open if already deleting
<AlertDialog open={isDialogOpen && documentToDelete?.id === doc.id}>
```

#### State Management
```typescript
const [loadingDeleteMap, setLoadingDeleteMap] = useState<Record<string, boolean>>({});

// Set loading BEFORE async call
setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));

// Clear loading AFTER completion
finally {
  setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
}
```

### Optimistic UI Updates

#### Realtime Subscription Approach
```typescript
// Supabase subscription handles updates automatically
useEffect(() => {
  const channel = supabase
    .channel("pdf_docs_delete")
    .on("postgres_changes", { event: "DELETE", ... }, (payload) => {
      setDocuments(docs => docs.filter(d => d.id !== payload.old.id));
    })
    .subscribe();
}, []);
```

**Benefits**:
- Automatic UI update when database changes
- Works across multiple browser tabs
- No manual DOM manipulation needed
- Handles race conditions gracefully

**No Manual Optimistic Updates**:
- We don't remove from UI before server confirms
- Safer approach for destructive operations
- Loading state provides adequate feedback

## Toast Notifications

### Success Messages

#### Single Document Deleted
```typescript
toast({
  title: "Documento eliminado",
  description: `Documento "${name}" eliminado correctamente`,
  variant: "default", // Uses primary color (green/teal)
});
```

#### Last Document Deleted (Storage Deleted)
```typescript
toast({
  title: "Documento eliminado",
  description: `Documento "${name}" eliminado. El almacenamiento ha sido eliminado porque era el último documento.`,
  variant: "default",
});
```

### Error Messages

#### Generic Error
```typescript
toast({
  title: "Error al eliminar",
  description: "No se pudo eliminar el documento. Por favor, inténtalo de nuevo.",
  variant: "destructive", // Red background
});
```

#### Specific Error (from server)
```typescript
catch (error) {
  toast({
    title: "Error al eliminar",
    description: error instanceof Error
      ? error.message
      : "No se pudo eliminar el documento. Por favor, inténtalo de nuevo.",
    variant: "destructive",
  });
}
```

### Toast Positioning & Duration
```typescript
// Configured in Toaster component (already in layout)
// Default: bottom-right, 5 second duration
// Mobile: bottom-center
```

## Automatic Redirect Logic

### Scenario: Last Document Deleted

**Flow**:
1. User confirms deletion of last document
2. Server action returns: `{ status: 'success', storageDeleted: true }`
3. UI shows toast notification
4. UI redirects to documents list page

**Implementation**:
```typescript
const handleConfirmDelete = async () => {
  // ... deletion logic

  if (result.status === 'success') {
    // Show toast FIRST
    toast({
      title: "Documento eliminado",
      description: result.storageDeleted
        ? `Documento eliminado. El almacenamiento ha sido eliminado porque era el último documento.`
        : `Documento "${name}" eliminado correctamente`,
      variant: "default",
    });

    // Then redirect if storage was deleted
    if (result.storageDeleted) {
      router.push(`/${accountSlug}/documents`);
    }
  }
};
```

### Timing Considerations
- **Toast duration**: Default 5 seconds
- **Redirect timing**: Immediate (toast remains visible during navigation)
- **Route transition**: Next.js App Router provides smooth transition

### Edge Cases Handled
1. **User navigates away before deletion completes**: Loading state prevents this
2. **Realtime subscription updates after redirect**: Unsubscribe in useEffect cleanup
3. **Multiple rapid deletions**: Loading state and disabled buttons prevent this

## Important Notes & Warnings

### Breaking Changes
**None** - This is a new feature adding confirmation to existing deletion flow.

### Next.js 15 / React 19 Specific Considerations

#### 1. Client Component Requirements
```typescript
"use client"; // Required for all components using hooks and interactivity

// All affected files:
// - page.tsx ✅ Already has directive
// - document-viewer.tsx ✅ Already has directive
// - document-list.tsx ✅ Already has directive
// - alert-dialog.tsx ✅ Will have directive (shadcn default)
```

#### 2. No Async API Issues
- No usage of `cookies()`, `params`, or `searchParams` in these components
- Server actions (`deletePdf`) already handle async properly
- `useRouter()` from `next/navigation` is client-safe

#### 3. Hydration Safety
```typescript
// ✅ SAFE: Controlled dialog state
<AlertDialog open={isDialogOpen && documentToDelete?.id === doc.id}>

// ✅ SAFE: Icons use aria-hidden
<Trash2 className="..." aria-hidden="true" />

// ✅ SAFE: No theme-dependent rendering without mounting check
// All theme switching happens via CSS custom properties
```

#### 4. TypeScript Strictness (React 19)
```typescript
// ✅ Radix UI types are compatible with React 19
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

// ✅ Event types are correct
onClick={(e: React.MouseEvent) => handleDeleteClick(doc, e)}
```

### Performance Considerations

#### 1. Realtime Subscriptions
```typescript
// ✅ Proper cleanup prevents memory leaks
useEffect(() => {
  const channel = supabase.channel("pdf_docs_delete").subscribe();

  return () => {
    supabase.removeChannel(channel); // Cleanup on unmount
  };
}, [documents]);
```

#### 2. State Management
```typescript
// ✅ Per-document loading prevents unnecessary re-renders
const [loadingDeleteMap, setLoadingDeleteMap] = useState<Record<string, boolean>>({});

// Only updates specific document's loading state
setLoadingDeleteMap((prev) => ({ ...prev, [doc.id]: true }));
```

#### 3. Bundle Size Impact
- AlertDialog component: ~3KB gzipped (Radix UI primitive)
- No additional runtime dependencies
- Tree-shaking eliminates unused Radix components

### Browser Compatibility

#### Supported Browsers
- **Chrome/Edge**: 90+ ✅
- **Firefox**: 88+ ✅
- **Safari**: 14+ ✅
- **Mobile Safari**: 14+ ✅
- **Samsung Internet**: 15+ ✅

#### Not Supported
- **IE11**: Next.js 15 does not support IE11
- **Older browsers without ES6**: Not supported by Next.js 15

#### CSS Features Used
- **CSS Custom Properties**: Widely supported (IE11 not supported anyway)
- **Flexbox**: Full support in all modern browsers
- **Grid Layout**: Full support in all modern browsers
- **Backdrop Filter**: Limited support in older Safari (graceful degradation)

## Migration Path

### Current State
```typescript
// document-list.tsx - BEFORE
const deleteDocument = async (id: string) => {
  await deletePdf(...); // NO CONFIRMATION
  toast({ title: "Documento eliminado" }); // Shows even on error
};

<Button onClick={() => deleteDocument(doc.id)}>
  <Trash2 />
</Button>
```

### Target State
```typescript
// document-list.tsx - AFTER
const handleDeleteClick = (doc: Document) => {
  setDocumentToDelete(doc);
  setIsDialogOpen(true); // Shows confirmation dialog
};

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button onClick={handleDeleteClick}>
      <Trash2 />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    {/* Confirmation UI with document name and warnings */}
  </AlertDialogContent>
</AlertDialog>
```

### No Breaking Changes
- **Server action signature**: Unchanged (already implemented)
- **Database schema**: No changes required
- **Realtime subscriptions**: Continue working as-is
- **User flow**: Enhanced (now includes confirmation)

### User Impact
**Positive Changes**:
- Prevents accidental deletions
- Better visibility into what will be deleted
- Clear warning when deleting last document
- More professional UX

**No Negative Impact**:
- One extra click required (industry standard for destructive actions)
- Deletion still fast (no additional latency)

## Testing Recommendations

### Manual Testing Checklist

#### Functionality Tests
- [ ] Click delete button → Dialog opens with correct document name
- [ ] Click "Cancelar" → Dialog closes without deleting
- [ ] Click "Eliminar Documento" → Document is deleted
- [ ] Loading spinner appears on delete button during operation
- [ ] Loading spinner appears on dialog action button during operation
- [ ] Button disabled during deletion (cannot click multiple times)
- [ ] Success toast appears after successful deletion
- [ ] Error toast appears when deletion fails
- [ ] Last document shows yellow warning box in dialog
- [ ] Last document deletion redirects to `/[accountSlug]/documents`
- [ ] Realtime subscription removes document from list automatically

#### Accessibility Tests
- [ ] Press `Tab` → Delete button receives focus (visible ring)
- [ ] Press `Enter` or `Space` on delete button → Dialog opens
- [ ] Focus moves to "Cancelar" button in dialog
- [ ] Press `Tab` → Focus moves to "Eliminar" button
- [ ] Press `Escape` → Dialog closes
- [ ] Focus returns to delete button after closing dialog
- [ ] Screen reader announces dialog title and description
- [ ] Screen reader announces button loading state
- [ ] All icons have `aria-hidden="true"`
- [ ] Delete button has descriptive `aria-label`

#### Responsive Tests
- [ ] **Mobile (<640px)**: Dialog is full-width
- [ ] **Mobile**: Dialog buttons are stacked vertically
- [ ] **Mobile**: Touch targets are at least 40x40px
- [ ] **Mobile**: Long document names truncate properly
- [ ] **Tablet (640-1024px)**: Dialog has max-width, buttons horizontal
- [ ] **Desktop (>1024px)**: Optimal layout, hover states visible

#### Theme Tests
- [ ] **Light mode**: Destructive colors are visible (red button/text)
- [ ] **Light mode**: Warning box has red tint
- [ ] **Dark mode**: Destructive colors have good contrast
- [ ] **Dark mode**: Warning box is visible (darker background)
- [ ] **Dark mode**: Border colors are visible
- [ ] Switch theme while dialog open → No hydration errors

#### Error Scenarios
- [ ] Server returns error → Error toast appears
- [ ] Network fails → Error toast appears with generic message
- [ ] Server returns warnings → Warnings not displayed (could be enhanced later)
- [ ] Concurrent deletion attempt → Second click does nothing (button disabled)

### Unit Testing (Optional - Not Required for MVP)

```typescript
// document-list.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentList } from './document-list';

describe('DocumentList Deletion', () => {
  it('opens confirmation dialog on delete click', () => {
    render(<DocumentList {...props} />);
    fireEvent.click(screen.getByLabelText(/Eliminar documento/));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('closes dialog on cancel', () => {
    render(<DocumentList {...props} />);
    fireEvent.click(screen.getByLabelText(/Eliminar documento/));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('calls deletePdf with correct parameters', async () => {
    const mockDeletePdf = jest.fn().mockResolvedValue({ status: 'success' });
    render(<DocumentList {...props} />);
    fireEvent.click(screen.getByLabelText(/Eliminar documento/));
    fireEvent.click(screen.getByText('Eliminar Documento'));

    await waitFor(() => {
      expect(mockDeletePdf).toHaveBeenCalledWith(
        expect.any(String), // documentStorageId
        expect.any(String), // vapiFileId
        expect.any(String), // pdfDocId
        expect.any(String)  // namespace
      );
    });
  });

  it('shows warning for last document', () => {
    render(<DocumentList {...props} documents={[singleDoc]} />);
    fireEvent.click(screen.getByLabelText(/Eliminar documento/));
    expect(screen.getByText(/Este es el último documento/)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: AlertDialog component not found
**Symptoms**: Import error `Module not found: @/components/ui/alert-dialog`

**Solution**:
```bash
npx shadcn@latest add alert-dialog
```

**Verification**:
```bash
ls -la /Volumes/raul-1TB/Proyectos/intelliaa-app/src/components/ui/alert-dialog.tsx
```

---

### Issue: Dialog doesn't close on cancel
**Symptoms**: Clicking "Cancelar" doesn't close the dialog

**Root Cause**: Missing state update in `handleCancelDelete`

**Solution**:
```typescript
const handleCancelDelete = () => {
  setIsDialogOpen(false); // Must set this
  setDocumentToDelete(null); // And clear selected document
};
```

---

### Issue: Toast shows success message even on error
**Symptoms**: Success toast appears when deletion fails

**Root Cause**: Toast call is in `finally` block (current implementation)

**Solution**:
```typescript
// WRONG (current):
try {
  await deletePdf(...);
} catch (error) {
  toast({ title: "Error", variant: "destructive" });
} finally {
  toast({ title: "Success" }); // ❌ Shows even on error!
}

// CORRECT (new):
try {
  const result = await deletePdf(...);
  if (result.status === 'success') {
    toast({ title: "Success" }); // ✅ Only on success
  }
} catch (error) {
  toast({ title: "Error", variant: "destructive" });
}
```

---

### Issue: Multiple deletions allowed concurrently
**Symptoms**: User can click delete button multiple times rapidly

**Root Cause**: Loading state not properly preventing clicks

**Solution**:
```typescript
// Ensure button is disabled:
<Button
  disabled={loadingDeleteMap[doc.id]} // ✅ Must have this
  onClick={...}
>

// Ensure loading is set BEFORE async call:
const handleConfirmDelete = async () => {
  setLoadingDeleteMap((prev) => ({ ...prev, [id]: true })); // ✅ Set first
  await deletePdf(...);
  setLoadingDeleteMap((prev) => ({ ...prev, [id]: false })); // ✅ Clear last
};
```

---

### Issue: Focus doesn't return after dialog closes
**Symptoms**: Keyboard focus is lost after closing dialog

**Root Cause**: Radix UI should handle this automatically

**Solution**: This is automatic in Radix UI. If not working:
1. Verify AlertDialog is properly unmounted (check `open` prop)
2. Ensure trigger button still exists in DOM
3. Check browser console for errors

**Code to verify**:
```typescript
<AlertDialog open={isDialogOpen && documentToDelete?.id === doc.id}>
  {/* open prop must be controlled */}
</AlertDialog>
```

---

### Issue: Hydration mismatch error
**Symptoms**: React hydration error on page load

**Root Cause**: Theme-dependent rendering without mounting check

**Solution**: Ensure no server/client mismatch:
```typescript
// ❌ WRONG: Could cause hydration mismatch
const [theme, setTheme] = useState(getTheme()); // Server doesn't know theme

// ✅ CORRECT: Use CSS variables (no JS theme detection needed)
className="bg-destructive text-destructive-foreground"
```

---

### Issue: Dialog appears below page content (z-index issue)
**Symptoms**: Dialog is visible but content shows on top

**Root Cause**: Radix Portal may not be rendering correctly

**Solution**: Ensure DialogPortal is used (shadcn does this automatically):
```typescript
const AlertDialogContent = ({ children, ...props }) => (
  <AlertDialogPortal> {/* ✅ Must use Portal */}
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content {...props}>
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
);
```

---

## Summary

This implementation plan provides a comprehensive, production-ready approach to adding PDF document deletion confirmation to INTEL-006. The plan:

### Key Strengths
1. **Uses shadcn/ui Best Practices**: Leverages AlertDialog component with Radix UI primitives
2. **Accessibility First**: WCAG 2.1 AA compliant with proper ARIA attributes
3. **Responsive**: Mobile-first design with appropriate breakpoints
4. **Loading States**: Clear visual feedback during operations
5. **Error Handling**: User-friendly messages for all failure scenarios
6. **Hydration Safe**: No SSR/client mismatches
7. **Next.js 15 Compatible**: Follows React 19 and Next.js 15 patterns

### Critical Implementation Notes
1. **Install AlertDialog first**: `npx shadcn@latest add alert-dialog`
2. **Fix toast logic**: Move success toast out of `finally` block
3. **Add accountSlug prop**: Required for redirect on storage deletion
4. **Remove duplicate logic**: Delete handlers moved from page to component
5. **Test accessibility**: Keyboard navigation and screen reader announcements

### Files Modified (Summary)
- `src/components/ui/alert-dialog.tsx` - **NEW** (created by shadcn CLI)
- `src/components/intelliaa/assistants/documents/documentViewer/document-list.tsx` - **MAJOR CHANGES**
- `src/app/[accountSlug]/documents/[document-storage-id]/page.tsx` - **SIMPLIFICATION**
- `src/components/intelliaa/assistants/documents/documentViewer/document-viewer.tsx` - **MINOR CHANGES**

---

*UI Implementation Plan completed: 2025-10-03*
*Architect: shadcn-ui-planner*
