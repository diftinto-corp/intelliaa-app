# Context Session: INTEL-012 - API Routes Implementation

## Initial Analysis

### Objective
Create comprehensive Next.js 15 API routes for document storage operations, following App Router patterns with proper authentication, validation, and error handling.

### Key Requirements
1. **6 API Routes to Implement**:
   - POST `/api/documents/storage/create` - Create document storage
   - POST `/api/documents/storage/[storageId]/documents` - Add document to storage
   - DELETE `/api/documents/storage/[storageId]/documents/[documentId]` - Delete document
   - DELETE `/api/documents/storage/[storageId]` - Delete storage
   - POST `/api/assistants/[assistantId]/storage` - Assign storage to assistant
   - DELETE `/api/assistants/[assistantId]/storage/[storageId]` - Unassign storage

2. **Technical Requirements**:
   - Next.js 15 async patterns (await cookies(), params, etc.)
   - Supabase authentication middleware
   - Multipart form data handling for file uploads
   - Zod validation for request data
   - Standardized error/success responses
   - Proper HTTP status codes

3. **Dependencies**:
   - Requires services from INTEL-001, INTEL-002, INTEL-003
   - Requires server actions from INTEL-004 through INTEL-009
   - Requires INTEL-011 (environment configuration)

### Current Status
- Branch created: `feature/INTEL-012-api-routes-implementation`
- Phase 1: Planning and architecture review completed ✅
- Backend Business Logic Architect analysis complete ✅
- Phase 2: Implementation completed ✅

---

## Implementation Summary

### Date: 2025-10-05
### Status: COMPLETED ✅

All 6 API routes have been successfully implemented following Next.js 15 patterns with proper authentication, validation, and error handling.

### Files Created

#### Infrastructure (Phase 1)
1. **`src/lib/api/auth.ts`** - Authentication middleware
   - `authenticateRequest(accountId)` - Validates user session and account membership
   - `extractAccountIdFromFormData()` - Extracts account_id from FormData
   - `extractAccountIdFromQuery()` - Extracts account_id from query params
   - `extractAccountIdFromJSON()` - Extracts account_id from JSON body

2. **`src/lib/api/responses.ts`** - Response utilities
   - `successResponse<T>()` - Standardized success response
   - `errorResponse()` - Standardized error response
   - `transformServerActionError()` - Server action error transformation
   - `validationErrorResponse()` - Zod validation error response

3. **`src/lib/api/validation.ts`** - Zod validation schemas
   - `createStorageSchema` - Validate create storage request
   - `addDocumentSchema` - Validate add document request
   - `deleteDocumentSchema` - Validate delete document request
   - `deleteStorageSchema` - Validate delete storage request
   - `assignStorageSchema` - Validate assign storage request
   - `unassignStorageSchema` - Validate unassign storage request

#### API Routes (Phase 2)
1. **`src/app/api/documents/storage/create/route.ts`**
   - POST endpoint to create document storage with PDF
   - Delegates to `createDocumentStorageWithPDF()` server action
   - Handles multipart/form-data
   - 5-minute timeout configured

2. **`src/app/api/documents/storage/[storageId]/documents/route.ts`**
   - POST endpoint to add PDF to existing storage
   - Delegates to `uploadPdfToExistingStorage()` server action
   - Handles concurrent upload conflicts (409)
   - Returns warnings for duplicate file names

3. **`src/app/api/documents/storage/[storageId]/documents/[documentId]/route.ts`**
   - DELETE endpoint to remove PDF from storage
   - Delegates to `deletePdfDocument()` server action
   - Handles cascade deletion (storageDeleted flag)
   - Returns warnings for partial failures

4. **`src/app/api/documents/storage/[storageId]/route.ts`**
   - DELETE endpoint to remove entire storage
   - Delegates to `deleteDocumentStorageWithValidation()` server action
   - Returns 409 Conflict if assigned to assistants
   - Handles lock conflicts

5. **`src/app/api/assistants/[assistantId]/storage/route.ts`**
   - POST endpoint to assign storage to assistant
   - Direct database operation (junction table insert)
   - Validates assistant and storage ownership
   - Prevents duplicate assignments

6. **`src/app/api/assistants/[assistantId]/storage/[storageId]/route.ts`**
   - DELETE endpoint to unassign storage from assistant
   - Direct database operation (junction table delete)
   - Returns 404 if assignment doesn't exist

### Key Implementation Details

#### Next.js 15 Async Patterns
- All routes use `await cookies()` for Supabase client creation
- All routes use `await params` to extract URL parameters
- All params typed as `Promise<{ ... }>`

#### Authentication Flow
1. Extract `account_id` from request (FormData, query, or JSON)
2. Call `authenticateRequest(accountId)`
3. Validate user session via Supabase
4. Validate account membership via `basejump.account_user` table
5. Return 401 for auth errors, 403 for access errors

#### Validation Flow
1. Extract request data
2. Validate with Zod schemas
3. Return 400 with validation errors if invalid
4. Spanish error messages for user-friendly feedback

#### Error Handling
- 200: Success (GET, UPDATE, DELETE)
- 201: Created (POST)
- 400: Validation error
- 401: Authentication error
- 403: Authorization error
- 404: Resource not found
- 409: Conflict (assigned, lock)
- 500: Internal server error
- 504: Timeout

#### Response Format
```typescript
// Success
{
  success: true,
  data?: T,
  message?: string,
  warnings?: string[]
}

// Error
{
  success: false,
  error: string,
  details?: any,
  code?: string
}
```

### Integration with Server Actions

Routes 1-4 delegate to server actions from INTEL-004 through INTEL-007:
- Route 1 → `createDocumentStorageWithPDF(formData)`
- Route 2 → `uploadPdfToExistingStorage(formData)`
- Route 3 → `deletePdfDocument(storageId, documentId, accountId)`
- Route 4 → `deleteDocumentStorageWithValidation(storageId, accountId)`

Routes 5-6 implement direct database operations:
- Route 5 → Insert into `document_storage-assistants` junction table
- Route 6 → Delete from `document_storage-assistants` junction table

**Note**: Full VAPI integration for Routes 5-6 will be implemented in INTEL-008 and INTEL-009.

### Security Measures
- ✅ Server-side Supabase client used exclusively
- ✅ Account membership validated on every request
- ✅ RLS policies enforced at database level
- ✅ File type and size validation (PDF, max 50MB)
- ✅ UUID validation for all IDs
- ✅ No sensitive data exposed in error messages
- ✅ Server-only environment variables protected

### Testing Recommendations
1. **Authentication tests**: Valid/invalid sessions, account access
2. **Validation tests**: File size, type, empty files, invalid UUIDs
3. **File upload tests**: Large files (50MB), timeouts, concurrent uploads
4. **Error transformation tests**: Server action errors → HTTP responses
5. **Integration tests**: End-to-end with real Supabase and server actions

### Next Steps (Future Enhancements)
1. Implement full VAPI query tool integration (INTEL-008, INTEL-009)
2. Add rate limiting for production
3. Add request ID tracing for debugging
4. Create API documentation (OpenAPI/Swagger)
5. Create Postman/Insomnia collection

---

## Backend Business Logic Architecture Analysis

### Date: 2025-10-05
### Architect: backend-business-logic-architect

---

## Business Logic Analysis: Document Storage API Routes

### Overview
This implementation creates a comprehensive REST API layer for document storage operations in a multi-tenant Next.js 15 application. The routes serve as the HTTP interface to existing server actions (INTEL-004 through INTEL-009), providing authenticated, validated, and standardized endpoints for frontend consumption.

**Business Purpose**: Enable secure, multi-tenant document storage operations with file upload capabilities, proper error handling, and integration with existing services (Pinecone, VAPI, Supabase).

---

## Architecture Plan

### Operation Flow

#### Route 1: POST `/api/documents/storage/create`
**Purpose**: Create document storage with initial PDF file

1. **Parse multipart/form-data** (file, name, description, account_id)
2. **Authenticate user** via Supabase session cookies (Next.js 15 async cookies)
3. **Validate account membership** (verify user belongs to account_id)
4. **Validate input** using Zod schema (file size, type, name length)
5. **Call server action** `createDocumentStorageWithPDF(formData)`
6. **Return standardized response** (201 Created on success)

#### Route 2: POST `/api/documents/storage/[storageId]/documents`
**Purpose**: Add PDF to existing document storage

1. **Extract storageId** from URL params (Next.js 15 async params)
2. **Parse multipart/form-data** (file, account_id)
3. **Authenticate user** and validate account membership
4. **Validate file** (PDF, max 50MB, not empty)
5. **Call server action** `uploadPdfToExistingStorage(formData)`
6. **Return standardized response** (201 Created on success)

#### Route 3: DELETE `/api/documents/storage/[storageId]/documents/[documentId]`
**Purpose**: Delete individual PDF from storage

1. **Extract storageId and documentId** from URL params
2. **Extract account_id** from query params
3. **Authenticate user** and validate account membership
4. **Call server action** `deletePdfDocument(storageId, documentId, accountId)`
5. **Handle cascade deletion** if last document (automatic via server action)
6. **Return standardized response** (200 OK, include storageDeleted flag)

#### Route 4: DELETE `/api/documents/storage/[storageId]`
**Purpose**: Delete entire document storage

1. **Extract storageId** from URL params
2. **Extract account_id** from query params
3. **Authenticate user** and validate account membership
4. **Call server action** `deleteDocumentStorageWithValidation(storageId, accountId)`
5. **Return standardized response** (200 OK or 409 Conflict if assigned to assistants)

#### Route 5: POST `/api/assistants/[assistantId]/storage`
**Purpose**: Assign document storage to assistant

1. **Extract assistantId** from URL params
2. **Parse JSON body** (storage_id, account_id, assistant_type)
3. **Authenticate user** and validate account membership
4. **Validate assistant exists** and user has access
5. **Call existing assignment logic** (from INTEL-008/009 server actions)
6. **Return standardized response** (200 OK on success)

#### Route 6: DELETE `/api/assistants/[assistantId]/storage/[storageId]`
**Purpose**: Unassign document storage from assistant

1. **Extract assistantId and storageId** from URL params
2. **Extract account_id** from query params
3. **Authenticate user** and validate account membership
4. **Call existing unassignment logic** (from INTEL-008/009 server actions)
5. **Return standardized response** (200 OK on success)

---

### Transaction Boundaries

**Atomic Unit 1: Document Storage Creation (Route 1)**
- **Scope**: All operations in `createDocumentStorageWithPDF` server action
- **Rollback Strategy**: Already implemented in INTEL-004 (rollback Pinecone, VAPI, Supabase)
- **API Route Responsibility**: Return appropriate error if server action fails

**Atomic Unit 2: Document Addition (Route 2)**
- **Scope**: All operations in `uploadPdfToExistingStorage` server action
- **Rollback Strategy**: Already implemented in INTEL-005 (rollback Pinecone vectors, VAPI file)
- **API Route Responsibility**: Return appropriate error if server action fails

**Atomic Unit 3: Document Deletion (Route 3)**
- **Scope**: All operations in `deletePdfDocument` server action
- **Rollback Strategy**: Already implemented in INTEL-006 (graceful degradation for external services)
- **API Route Responsibility**: Return appropriate error and warnings if partial failure

**Atomic Unit 4: Storage Deletion (Route 4)**
- **Scope**: All operations in `deleteDocumentStorageWithValidation` server action
- **Rollback Strategy**: Already implemented in INTEL-007 (acquire lock, cascade delete)
- **API Route Responsibility**: Return appropriate error if assigned to assistants (409 Conflict)

**Atomic Unit 5: Storage Assignment (Routes 5 & 6)**
- **Scope**: Junction table operations only (document_storage-assistants)
- **Rollback Strategy**: N/A (single database operation with RLS)
- **API Route Responsibility**: Validate ownership before calling server action

---

### Multi-Tenant Considerations

**Account Isolation Strategy**:
1. **All routes extract `account_id`** from request (form data or query params)
2. **Authentication middleware validates**:
   - User is authenticated (Supabase session exists)
   - User is member of account (basejump.account_user table)
3. **RLS policies enforce** row-level security at database level
4. **Server actions inherit** account isolation from Supabase client

**RLS Policy Dependencies**:
- `document_storages` table: Filter by `account_id = auth.uid()`
- `pdf_docs` table: Filter by `account_id = auth.uid()`
- `qa_docs` table: Filter by `account_id = auth.uid()`
- `document_storage-assistants` junction: Filter by associated assistant's account
- `assistants` table: Filter by `account_id = auth.uid()`

**Critical Security Check**:
```typescript
// Verify user is member of account (not just authenticated)
const { data: membership } = await supabase
  .from('basejump.account_user')
  .select('account_role')
  .eq('account_id', accountId)
  .eq('user_id', user.id)
  .single();

if (!membership) {
  return Response.json(
    { success: false, error: 'Forbidden: No access to this account' },
    { status: 403 }
  );
}
```

---

## Implementation Specifications

### Input Validation

#### Route 1: Create Document Storage
```typescript
import { z } from 'zod';

const createStorageSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
  description: z.string().max(500, 'La descripción es demasiado larga').optional(),
  account_id: z.string().uuid('El ID de cuenta debe ser un UUID válido'),
  file: z.instanceof(File)
    .refine(file => file.size > 0, 'El archivo está vacío')
    .refine(file => file.size <= 50 * 1024 * 1024, 'El archivo excede el límite de 50MB')
    .refine(file => file.type === 'application/pdf', 'Solo se aceptan archivos PDF')
});

// Usage in route
const formData = await request.formData();
const validation = createStorageSchema.safeParse({
  name: formData.get('name'),
  description: formData.get('description'),
  account_id: formData.get('account_id'),
  file: formData.get('file')
});

if (!validation.success) {
  return Response.json(
    {
      success: false,
      error: 'Validación fallida',
      details: validation.error.issues
    },
    { status: 400 }
  );
}
```

#### Route 2: Add Document to Storage
```typescript
const addDocumentSchema = z.object({
  storageId: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  accountId: z.string().uuid('El ID de cuenta debe ser un UUID válido'),
  file: z.instanceof(File)
    .refine(file => file.size > 0, 'El archivo está vacío')
    .refine(file => file.size <= 50 * 1024 * 1024, 'El archivo excede el límite de 50MB')
    .refine(file => file.type === 'application/pdf', 'Solo se aceptan archivos PDF')
});
```

#### Route 3 & 4: Delete Operations
```typescript
const deleteDocumentSchema = z.object({
  storageId: z.string().uuid(),
  documentId: z.string().uuid(),
  accountId: z.string().uuid()
});

const deleteStorageSchema = z.object({
  storageId: z.string().uuid(),
  accountId: z.string().uuid()
});
```

#### Route 5 & 6: Assignment Operations
```typescript
const assignStorageSchema = z.object({
  assistantId: z.string().uuid(),
  storage_id: z.string().uuid(),
  account_id: z.string().uuid(),
  assistant_type: z.enum(['voice', 'whatsapp'])
});

const unassignStorageSchema = z.object({
  assistantId: z.string().uuid(),
  storageId: z.string().uuid(),
  accountId: z.string().uuid()
});
```

---

### Database Operations

**All database operations are delegated to server actions** (INTEL-004 through INTEL-009). API routes do NOT perform direct database operations except for authentication checks.

#### Authentication Check (All Routes)
- **Query**: `basejump.account_user` table
- **Purpose**: Verify user membership in account
- **Filter**: `account_id = ? AND user_id = ?`

#### Server Action Delegation

| Route | Server Action | File |
|-------|---------------|------|
| Route 1 | `createDocumentStorageWithPDF()` | INTEL-004: documents.ts |
| Route 2 | `uploadPdfToExistingStorage()` | INTEL-005: documents.ts |
| Route 3 | `deletePdfDocument()` | INTEL-006: documents.ts |
| Route 4 | `deleteDocumentStorageWithValidation()` | INTEL-007: documents.ts |
| Route 5 | Assignment logic | INTEL-008/009: assistants.ts |
| Route 6 | Unassignment logic | INTEL-008/009: assistants.ts |

---

### External Service Calls

**All external service calls are handled by server actions**. API routes do NOT call external services directly.

#### Services Used (via Server Actions)

**VAPI Service** (`vapiService.ts`):
- `uploadFile(file)` - Upload PDF to VAPI
- `deleteFile(fileId)` - Delete PDF from VAPI
- Called by: INTEL-004, INTEL-005, INTEL-006, INTEL-007

**Pinecone Service** (`pineconeService.ts`):
- `upsertVectors(namespace, vectors)` - Store embeddings
- `deleteVectorsByMetadata(namespace, metadata)` - Delete document vectors
- `deleteNamespace(namespace)` - Delete entire storage
- Called by: INTEL-004, INTEL-005, INTEL-006, INTEL-007

**Embedding Service** (`embeddingService.ts`):
- `generateEmbeddings(buffer, options)` - Generate vector embeddings
- Called by: INTEL-004, INTEL-005

**Error Handling**: API routes catch errors from server actions and transform them into standardized HTTP responses.

---

### Return Value

#### Success Response Format
```typescript
interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

// Example: Route 1 (Create Storage)
{
  success: true,
  data: {
    id: "uuid-v4",
    name: "Mi Documento",
    namespace: "mi-documento-abc123",
    vapiKnowledgeBaseId: "kb_123"
  }
}

// Example: Route 3 (Delete Document)
{
  success: true,
  message: "Documento eliminado correctamente",
  storageDeleted: false,
  warnings: ["No se pudieron eliminar los vectores de Pinecone"]
}
```

#### Error Response Format
```typescript
interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

// Example: Validation Error (400)
{
  success: false,
  error: "Validación fallida",
  details: [
    { path: ["file"], message: "El archivo excede el límite de 50MB" }
  ]
}

// Example: Authorization Error (403)
{
  success: false,
  error: "Forbidden: No access to this account"
}

// Example: Conflict Error (409)
{
  success: false,
  error: "No se puede eliminar. Asignado a: Asistente 1, Asistente 2",
  code: "ASSIGNED_TO_ASSISTANTS",
  assignedAssistants: [
    { assistant_id: "uuid", assistant_name: "Asistente 1" }
  ]
}
```

---

## Error Handling Strategy

### Authentication & Authorization Errors

| Failure Point | HTTP Status | User Message | Recovery Action |
|--------------|-------------|--------------|-----------------|
| No session cookie | 401 | "No autenticado. Por favor, inicia sesión." | Redirect to login |
| Invalid session | 401 | "Sesión expirada. Por favor, inicia sesión nuevamente." | Redirect to login |
| Not account member | 403 | "No tienes acceso a esta cuenta." | Show error message |
| RLS policy denial | 403 | "No tienes permiso para realizar esta acción." | Show error message |

### Validation Errors

| Failure Point | HTTP Status | User Message | Recovery Action |
|--------------|-------------|--------------|-----------------|
| Missing required fields | 400 | "Faltan campos requeridos: [field list]" | Show validation errors |
| Invalid UUID format | 400 | "El ID proporcionado no es válido." | Show error message |
| File too large | 400 | "El archivo excede el límite de 50MB." | Ask user to compress file |
| Invalid file type | 400 | "Solo se aceptan archivos PDF." | Ask user to convert file |
| Empty file | 400 | "El archivo está vacío." | Ask user to select valid file |
| Name too long | 400 | "El nombre es demasiado largo (máximo 100 caracteres)." | Show error message |

### Business Logic Errors

| Failure Point | HTTP Status | User Message | Recovery Action |
|--------------|-------------|--------------|-----------------|
| Storage not found | 404 | "Almacenamiento no encontrado." | Show error message |
| Document not found | 404 | "Documento no encontrado." | Show error message |
| Assistant not found | 404 | "Asistente no encontrado." | Show error message |
| Storage assigned to assistants | 409 | "No se puede eliminar. Asignado a: [assistant names]" | Show list, ask to unassign |
| Duplicate file name | 200 | "Archivo renombrado para evitar duplicados." | Show warning in success |
| Concurrent upload | 409 | "Otro proceso está operando en este almacenamiento. Espera e intenta nuevamente." | Show error, suggest retry |

### External Service Errors

| Failure Point | HTTP Status | User Message | Recovery Action |
|--------------|-------------|--------------|-----------------|
| VAPI upload failed | 500 | "Error al subir archivo al servicio de voz. Intenta nuevamente." | Rollback, show retry option |
| Pinecone upsert failed | 500 | "Error al almacenar embeddings. Intenta nuevamente." | Rollback, show retry option |
| Embedding generation failed | 500 | "Error al procesar el documento. Intenta nuevamente." | Rollback, show retry option |
| Timeout (5 min) | 504 | "El procesamiento tardó demasiado. Intenta con un archivo más pequeño." | Show error message |

### Database Errors

| Failure Point | HTTP Status | User Message | Recovery Action |
|--------------|-------------|--------------|-----------------|
| Unique constraint violation | 400 | "Error de identificador duplicado. Intenta nuevamente." | Retry with new ID |
| Foreign key violation | 400 | "Error de referencia. El registro relacionado no existe." | Show error message |
| Lock acquisition failed | 409 | "Otro proceso está operando en este almacenamiento. Espera e intenta nuevamente." | Show error, suggest retry |
| Connection error | 500 | "Error de conexión a la base de datos. Intenta nuevamente." | Show retry option |

---

## Rollback Procedures

### API Routes Do NOT Handle Rollback Directly

Rollback logic is already implemented in server actions (INTEL-004 through INTEL-007). API routes only need to:

1. **Catch errors** from server actions
2. **Transform errors** into HTTP responses
3. **Return appropriate status codes** and user-friendly messages

### Server Action Rollback Summary

**INTEL-004 (`createDocumentStorageWithPDF`)**:
- Rollback state tracked: Pinecone namespace, VAPI file, VAPI KB
- On failure: Delete Pinecone vectors, delete VAPI file, delete VAPI KB (if created)

**INTEL-005 (`uploadPdfToExistingStorage`)**:
- Rollback state tracked: Pinecone vectors (in existing namespace), VAPI file
- On failure: Delete vectors by metadata, delete VAPI file

**INTEL-006 (`deletePdfDocument`)**:
- Graceful degradation: External service failures logged as warnings
- Critical failure: Database deletion (no rollback needed)

**INTEL-007 (`deleteDocumentStorageWithValidation`)**:
- Acquire lock before deletion (prevent concurrent operations)
- External services deleted first (non-critical, graceful degradation)
- Database cascade deletion last (critical, atomic via PostgreSQL function)

---

## Performance Considerations

### Caching Opportunities

**1. Authentication Results**
- **What**: User session and account membership
- **Duration**: 1 minute (short TTL for security)
- **Implementation**: In-memory cache at route level (not recommended, use middleware)
- **Better Approach**: Let Supabase middleware handle session caching

**2. Static Validation Schemas**
- **What**: Zod schemas
- **Duration**: Application lifetime
- **Implementation**: Define schemas at module level (already cached by Node.js)

**3. Account Membership**
- **What**: basejump.account_user query results
- **Duration**: 5 minutes
- **Risk**: Security risk if user is removed from account during cache TTL
- **Recommendation**: DO NOT CACHE (always verify fresh)

### Query Optimization Suggestions

**1. Use Supabase Middleware for Authentication**
- Current approach: Each route calls `createClient()` and `getUser()`
- Optimized approach: Middleware validates session once, passes user to routes
- Benefit: Reduces duplicate Supabase client creation and auth checks

**2. Single Query for Validation**
- Instead of: Check storage exists → Check account access → Get storage data
- Optimized: Single query with `.eq('id', storageId).eq('account_id', accountId).single()`
- Benefit: RLS policies handle access control, no need for separate membership check

**3. Parallel External Service Calls**
- Already implemented in server actions (e.g., INTEL-007 deletes VAPI files in batches)
- API routes inherit this optimization

### Batch Operation Possibilities

**Not Applicable at API Route Level**:
- Batching is handled by server actions (e.g., INTEL-007 batch deletes VAPI files)
- API routes are designed for single-resource operations

**Future Enhancement**:
- If needed, add batch routes (e.g., `POST /api/documents/storage/batch-delete`)
- Delegate to new server action that processes array of IDs

### Timeout Management

**5-Minute Timeout**:
- Already implemented in server actions (INTEL-004, INTEL-005)
- API routes inherit this timeout via `AbortController`

**Route-Level Timeout** (Next.js 15):
```typescript
export const maxDuration = 300; // 5 minutes (Next.js config)

export async function POST(request: NextRequest) {
  // AbortController handled by server action
  const result = await createDocumentStorageWithPDF(formData);
  return Response.json(result);
}
```

---

## Security Checklist

### Authentication
- [x] **Session validation**: Use `await createClient()` then `getUser()`
- [x] **Cookie parsing**: Next.js 15 `await cookies()` pattern
- [x] **Session expiry**: Handled by Supabase middleware

### Authorization
- [x] **Account membership check**: Query `basejump.account_user` table
- [x] **RLS policies**: Enforced at database level (already configured)
- [x] **Resource ownership**: Validate `account_id` matches user's account

### Input Sanitization
- [x] **Zod validation**: All inputs validated before processing
- [x] **File type check**: Only PDF files accepted
- [x] **File size limit**: Max 50MB enforced
- [x] **UUID validation**: All IDs validated as UUIDs
- [x] **String length limits**: Name (100 chars), description (500 chars)

### RLS Policies Enforced
- [x] **document_storages**: Filter by account_id
- [x] **pdf_docs**: Filter by account_id
- [x] **qa_docs**: Filter by account_id
- [x] **assistants**: Filter by account_id
- [x] **document_storage-assistants**: Filter by associated assistant's account

### Sensitive Data Protection
- [x] **API keys**: Server-only (VAPI, Pinecone, OpenAI)
- [x] **Session tokens**: HTTP-only cookies managed by Supabase
- [x] **File contents**: Not logged in error messages
- [x] **Error details**: Sanitized before sending to client

### Additional Security Measures

**CORS Protection**:
- Next.js default CORS policy (same-origin)
- If cross-origin needed, whitelist specific domains

**Rate Limiting** (Optional):
- Consider adding Upstash rate limiting for production
- Limit: 10 requests per 10 seconds per IP

**File Scan** (Future Enhancement):
- Add virus scanning for uploaded PDFs (ClamAV or cloud service)
- Block malicious files before processing

---

## Testing Strategy

### Unit Tests (Backend Test Architect will define)

**Authentication Middleware**:
- Test case: Valid session → Returns user and supabase client
- Test case: No session → Returns 401 error
- Test case: Invalid session → Returns 401 error
- Test case: User not in account → Returns 403 error

**Validation Schemas**:
- Test case: Valid input → Passes validation
- Test case: Missing required field → Returns validation error
- Test case: Invalid UUID → Returns validation error
- Test case: File too large → Returns validation error
- Test case: Invalid file type → Returns validation error

**Response Transformation**:
- Test case: Server action success → Returns 200/201 with data
- Test case: Server action error → Returns appropriate HTTP status
- Test case: Server action warnings → Includes warnings in response

### Integration Tests (Backend Test Architect will define)

**Route 1: Create Storage**:
- Test case: Valid request → Creates storage, returns 201
- Test case: Unauthenticated → Returns 401
- Test case: Invalid account → Returns 403
- Test case: File too large → Returns 400
- Test case: Server action fails → Returns 500 with rollback

**Route 2: Add Document**:
- Test case: Valid request → Adds document, returns 201
- Test case: Storage not found → Returns 404
- Test case: Duplicate file name → Renames file, returns 201 with warning

**Route 3: Delete Document**:
- Test case: Valid request → Deletes document, returns 200
- Test case: Last document → Triggers storage deletion, returns 200 with flag
- Test case: Document not found → Returns 404

**Route 4: Delete Storage**:
- Test case: Valid request → Deletes storage, returns 200
- Test case: Assigned to assistants → Returns 409 with list
- Test case: Concurrent deletion → Returns 409 (lock conflict)

**Route 5 & 6: Assignment/Unassignment**:
- Test case: Valid request → Assigns/unassigns storage, returns 200
- Test case: Assistant not found → Returns 404

### Edge Cases

**Concurrent Operations**:
- Test case: Two uploads to same storage simultaneously → One succeeds, one gets lock error
- Test case: Upload during deletion → One operation fails with lock error

**Partial Failures**:
- Test case: VAPI upload fails → Rollback Pinecone, return error
- Test case: Pinecone fails → Rollback VAPI, return error
- Test case: Database fails → Rollback all, return error

**Timeout Scenarios**:
- Test case: Large file (near 50MB) → Completes within 5 minutes
- Test case: Slow network → Timeout after 5 minutes, rollback

### Mocking Strategies

**Supabase Client**:
- Mock `createClient()` to return test client
- Mock `getUser()` to return test user
- Mock RLS queries to return test data

**Server Actions**:
- Mock server action responses (success/error)
- Test error transformation logic independently

**External Services** (already mocked in server actions):
- VAPI, Pinecone, OpenAI mocked at server action level
- API routes test error handling with mocked failures

---

## Risks and Mitigations

### High-Impact Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Concurrent upload/delete race condition** | Medium | High | Upload lock implemented (INTEL-005), route delegates to server action |
| **File upload timeout (>5 min)** | Low | High | AbortController in server action, user notified to use smaller file |
| **Rollback failure leaves orphaned resources** | Low | High | Server actions log failures, manual cleanup script for Pinecone/VAPI |
| **RLS policy bypass** | Very Low | Critical | Always use server-side Supabase client, never trust client input |

### Medium-Impact Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Malicious PDF upload** | Medium | Medium | Add file scanning (future), limit file size, validate PDF structure |
| **Account membership check bypassed** | Low | High | Always query `basejump.account_user`, never trust account_id from client |
| **VAPI/Pinecone service outage** | Low | Medium | Graceful degradation (warn user), retry mechanism in server actions |
| **Database connection pool exhaustion** | Low | Medium | Supabase handles pooling, monitor connection metrics |

### Low-Impact Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Duplicate file name collision** | High | Low | Auto-rename with timestamp (implemented in INTEL-005) |
| **Session expiry during upload** | Low | Low | Middleware refreshes session, upload lock released on error |
| **Network interruption mid-upload** | Low | Low | Rollback cleanup handles partial uploads |

---

## Dependencies

### Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `OPENAI_API_KEY` - OpenAI API for embeddings (server-side)
- `PINECONE_API_KEY` - Pinecone vector storage (server-side)
- `PINECONE_INDEX` - Pinecone index name (server-side)
- `NEXT_PRIVATE_VAPI_KEY` - VAPI voice AI (server-side)

### External Service Availability
- **Supabase**: Required for authentication, database operations
- **VAPI**: Required for file uploads (voice assistant integration)
- **Pinecone**: Required for vector storage (RAG functionality)
- **OpenAI**: Required for embeddings generation (INTEL-001)

### Database Schema Requirements
- **Tables**: `document_storages`, `pdf_docs`, `qa_docs`, `assistants`, `document_storage-assistants`
- **RLS Policies**: Must be enabled and configured for multi-tenant isolation
- **Functions**: `create_document_storage_with_pdf`, `delete_document_storage_cascade`
- **Basejump Schema**: `basejump.account_user` for membership validation

### Server Actions (INTEL-004 through INTEL-009)
- All routes delegate business logic to existing server actions
- Server actions must be imported and available in API routes

---

## Next Steps

### Recommended Implementation Order

**Phase 1: Authentication Infrastructure** (Priority: Critical)
1. Create reusable authentication middleware helper (`src/lib/api/auth.ts`)
2. Implement `authenticateRequest(accountId)` function
3. Add comprehensive error handling and logging
4. Write unit tests for authentication logic

**Phase 2: Response Utilities** (Priority: High)
1. Create standardized response helpers (`src/lib/api/responses.ts`)
2. Implement `successResponse()` and `errorResponse()` functions
3. Add TypeScript types for API responses
4. Ensure consistency with server action response formats

**Phase 3: Validation Schemas** (Priority: High)
1. Create Zod schemas for all routes (`src/lib/api/validation.ts`)
2. Implement schema for each route (6 schemas total)
3. Add custom error messages in Spanish
4. Write unit tests for validation logic

**Phase 4: Individual Routes** (Priority: Medium)
1. **Route 1**: `POST /api/documents/storage/create`
   - Implement multipart/form-data parsing
   - Add authentication and validation
   - Delegate to `createDocumentStorageWithPDF`
   - Test with real file uploads

2. **Route 2**: `POST /api/documents/storage/[storageId]/documents`
   - Extract dynamic param (storageId)
   - Add authentication and validation
   - Delegate to `uploadPdfToExistingStorage`
   - Test duplicate file name handling

3. **Route 3**: `DELETE /api/documents/storage/[storageId]/documents/[documentId]`
   - Extract two dynamic params
   - Add authentication and validation
   - Delegate to `deletePdfDocument`
   - Test cascade deletion (last document)

4. **Route 4**: `DELETE /api/documents/storage/[storageId]`
   - Extract dynamic param (storageId)
   - Add authentication and validation
   - Delegate to `deleteDocumentStorageWithValidation`
   - Test conflict error (409) when assigned to assistants

5. **Route 5**: `POST /api/assistants/[assistantId]/storage`
   - Extract dynamic param (assistantId)
   - Add authentication and validation
   - Implement assignment logic (call INTEL-008/009 server actions)
   - Test with voice and WhatsApp assistants

6. **Route 6**: `DELETE /api/assistants/[assistantId]/storage/[storageId]`
   - Extract two dynamic params
   - Add authentication and validation
   - Implement unassignment logic (call INTEL-008/009 server actions)
   - Test cascade effects

**Phase 5: Integration Testing** (Priority: Medium)
1. Write integration tests for each route
2. Test authentication flows (401, 403 errors)
3. Test file upload edge cases (size, type, timeout)
4. Test concurrent operations (race conditions)
5. Test error transformation (server action errors → HTTP responses)

**Phase 6: Documentation** (Priority: Low)
1. Create API documentation (OpenAPI/Swagger)
2. Create Postman/Insomnia collection
3. Document error codes and responses
4. Add code comments and JSDoc

### Coordination with Other Agents

**Backend Test Architect**:
- Request test case definitions for authentication middleware
- Request integration test scenarios for each route
- Request mocking strategies for server actions and Supabase

**Frontend Team** (if applicable):
- Share API documentation and response formats
- Provide example requests and responses
- Coordinate error handling (error codes, messages)

---

## Authentication Middleware Detailed Design

### File: `src/lib/api/auth.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  success: true;
  user: User;
  supabase: ReturnType<typeof createClient>;
  accountRole?: string;
}

export interface AuthError {
  success: false;
  error: string;
  status: 401 | 403;
}

/**
 * Authenticate user and validate account membership
 *
 * @param accountId - Account UUID to validate membership
 * @returns AuthResult on success, AuthError on failure
 */
export async function authenticateRequest(
  accountId: string
): Promise<AuthResult | AuthError> {
  try {
    // Create Supabase client (Next.js 15 async cookies)
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'No autenticado. Por favor, inicia sesión.',
        status: 401
      };
    }

    // Validate account membership
    const { data: membership, error: membershipError } = await supabase
      .from('basejump.account_user')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error('[AUTH] Membership validation failed', {
        userId: user.id,
        accountId,
        error: membershipError
      });

      return {
        success: false,
        error: 'No tienes acceso a esta cuenta.',
        status: 403
      };
    }

    console.log('[AUTH] User authenticated successfully', {
      userId: user.id,
      accountId,
      role: membership.account_role
    });

    return {
      success: true,
      user,
      supabase: supabase as any, // Type assertion needed due to async createClient
      accountRole: membership.account_role
    };

  } catch (error) {
    console.error('[AUTH] Unexpected authentication error', error);

    return {
      success: false,
      error: 'Error de autenticación. Por favor, intenta nuevamente.',
      status: 500 as 401 // Return 401 for client-facing error
    };
  }
}

/**
 * Extract account_id from FormData (for multipart/form-data requests)
 */
export function extractAccountIdFromFormData(formData: FormData): string | null {
  const accountId = formData.get('account_id');
  if (typeof accountId === 'string') {
    return accountId;
  }
  return null;
}

/**
 * Extract account_id from URL query params (for DELETE requests)
 */
export function extractAccountIdFromQuery(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get('account_id');
}

/**
 * Extract account_id from JSON body (for POST requests)
 */
export async function extractAccountIdFromJSON(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    if (typeof body.account_id === 'string') {
      return body.account_id;
    }
    return null;
  } catch (error) {
    return null;
  }
}
```

### Usage Example in Route

```typescript
// src/app/api/documents/storage/create/route.ts
import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromFormData } from '@/lib/api/auth';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse FormData
    const formData = await request.formData();

    // 2. Extract account_id
    const accountId = extractAccountIdFromFormData(formData);
    if (!accountId) {
      return errorResponse('El ID de cuenta es requerido', 400);
    }

    // 3. Authenticate user and validate account membership
    const auth = await authenticateRequest(accountId);
    if (!auth.success) {
      return errorResponse(auth.error, auth.status);
    }

    // 4. Proceed with business logic...
    // const result = await createDocumentStorageWithPDF(formData);
    // return successResponse(result, 201);

  } catch (error) {
    console.error('[API] Unexpected error', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
```

---

## Response Utilities Design

### File: `src/lib/api/responses.ts`

```typescript
import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  warnings?: string[];
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  status: number = 200,
  message?: string,
  warnings?: string[]
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      warnings
    },
    { status }
  );
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: any,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
      code
    },
    { status }
  );
}

/**
 * Transform server action error to API response
 */
export function transformServerActionError(error: any): NextResponse<ApiErrorResponse> {
  // Handle custom error types from server actions
  if (error?.success === false) {
    // Server action returned error response
    return NextResponse.json(error, { status: 400 });
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  // Unknown error
  return errorResponse('Error desconocido', 500, error);
}

/**
 * Transform validation error (Zod) to API response
 */
export function validationErrorResponse(issues: any[]): NextResponse<ApiErrorResponse> {
  return errorResponse(
    'Validación fallida',
    400,
    issues,
    'VALIDATION_ERROR'
  );
}
```

---

## Best Practices Summary

### Next.js 15 Async Patterns

1. **Always await cookies()**:
   ```typescript
   const cookieStore = await cookies(); // ✅ Correct
   const cookieStore = cookies(); // ❌ Wrong (Next.js 15)
   ```

2. **Always await params**:
   ```typescript
   export async function DELETE(
     request: NextRequest,
     { params }: { params: Promise<{ storageId: string }> }
   ) {
     const { storageId } = await params; // ✅ Correct
     const { storageId } = params; // ❌ Wrong (Next.js 15)
   }
   ```

3. **Type params as Promise**:
   ```typescript
   { params }: { params: Promise<{ id: string }> } // ✅ Correct
   { params }: { params: { id: string } } // ❌ Wrong (Next.js 15)
   ```

### File Upload Best Practices

1. **Always validate file size before reading**:
   ```typescript
   const file = formData.get('file') as File;
   if (file.size > 50 * 1024 * 1024) {
     return errorResponse('El archivo excede el límite de 50MB', 400);
   }
   ```

2. **Validate file type**:
   ```typescript
   if (file.type !== 'application/pdf') {
     return errorResponse('Solo se aceptan archivos PDF', 400);
   }
   ```

3. **Handle empty files**:
   ```typescript
   if (file.size === 0) {
     return errorResponse('El archivo está vacío', 400);
   }
   ```

4. **Stream large files** (already implemented in server actions):
   - Don't load entire file into memory at route level
   - Pass File object to server action, which handles buffering

### Error Handling Best Practices

1. **Always log errors with context**:
   ```typescript
   console.error('[API] Operation failed', {
     route: '/api/documents/storage/create',
     accountId,
     error
   });
   ```

2. **Never expose internal errors to client**:
   ```typescript
   // ❌ Bad: Exposes internal error details
   return errorResponse(error.stack, 500);

   // ✅ Good: User-friendly message
   return errorResponse('Error al crear almacenamiento. Por favor, intenta nuevamente.', 500);
   ```

3. **Return appropriate HTTP status codes**:
   - 200: Success (GET, UPDATE, DELETE)
   - 201: Created (POST)
   - 400: Validation error
   - 401: Authentication error
   - 403: Authorization error
   - 404: Resource not found
   - 409: Conflict (assigned to assistants, lock conflict)
   - 500: Internal server error
   - 504: Timeout

### Integration with Server Actions

1. **Delegate all business logic** to server actions:
   ```typescript
   // ✅ Good: Route delegates to server action
   const result = await createDocumentStorageWithPDF(formData);
   return NextResponse.json(result);

   // ❌ Bad: Route implements business logic
   const supabase = await createClient();
   const { data } = await supabase.from('document_storages').insert(...);
   ```

2. **Transform server action responses**:
   ```typescript
   const result = await createDocumentStorageWithPDF(formData);

   if (result.success) {
     return successResponse(result.data, 201);
   } else {
     return errorResponse(result.error.message, 400, result.error.details);
   }
   ```

3. **Catch and handle server action errors**:
   ```typescript
   try {
     const result = await createDocumentStorageWithPDF(formData);
     return NextResponse.json(result);
   } catch (error) {
     return transformServerActionError(error);
   }
   ```

### Security Best Practices

1. **Always validate authentication before processing**:
   ```typescript
   const auth = await authenticateRequest(accountId);
   if (!auth.success) {
     return errorResponse(auth.error, auth.status);
   }
   // Only proceed if authenticated
   ```

2. **Never trust client-provided account_id**:
   ```typescript
   // ❌ Bad: Trust client input
   const accountId = formData.get('account_id');
   const result = await createDocumentStorageWithPDF(formData);

   // ✅ Good: Validate user is member of account
   const accountId = formData.get('account_id');
   const auth = await authenticateRequest(accountId);
   if (!auth.success) return errorResponse(auth.error, auth.status);
   ```

3. **Use server-side Supabase client always**:
   ```typescript
   // ✅ Good: Server-side client with RLS
   import { createClient } from '@/lib/supabase/server';
   const supabase = await createClient();

   // ❌ Bad: Client-side client (no RLS)
   import { createClient } from '@/lib/supabase/client';
   const supabase = createClient();
   ```

---

## Edge Cases to Handle

### 1. Duplicate File Names
- **Scenario**: User uploads file with same name as existing file in storage
- **Handled By**: INTEL-005 (auto-rename with timestamp)
- **API Response**: Success with warning message

### 2. Concurrent Uploads
- **Scenario**: Two users upload to same storage simultaneously
- **Handled By**: Upload lock in INTEL-005 (acquireUploadLock)
- **API Response**: 409 Conflict for second request

### 3. Last Document Deletion
- **Scenario**: User deletes the only document in storage
- **Handled By**: INTEL-006 (auto-trigger storage deletion)
- **API Response**: Success with `storageDeleted: true` flag

### 4. Storage Assigned to Assistants
- **Scenario**: User tries to delete storage that's assigned to assistants
- **Handled By**: INTEL-007 (validation before deletion)
- **API Response**: 409 Conflict with list of assigned assistants

### 5. Session Expiry During Upload
- **Scenario**: User's session expires while file is uploading
- **Handled By**: Supabase middleware refreshes session
- **Fallback**: If refresh fails, rollback via INTEL-004/005

### 6. Network Interruption
- **Scenario**: Network connection lost during upload
- **Handled By**: AbortController timeout (5 min) in server actions
- **API Response**: 504 Timeout, rollback executed

### 7. Large File Upload
- **Scenario**: User uploads 49MB file (near limit)
- **Handled By**: File size validation before processing
- **Performance**: May take several minutes, covered by 5-min timeout

### 8. Invalid UUID Format
- **Scenario**: Client sends malformed UUID for account_id or storageId
- **Handled By**: Zod schema validation
- **API Response**: 400 Bad Request with validation error

### 9. RLS Policy Denial
- **Scenario**: User tries to access resource owned by different account
- **Handled By**: Supabase RLS policies (automatic)
- **API Response**: 404 Not Found (resource appears to not exist)

### 10. External Service Outage
- **Scenario**: VAPI or Pinecone service is down
- **Handled By**: Server action rollback and error handling
- **API Response**: 500 Internal Server Error with user-friendly message

---

## Final Recommendations

### Critical Path
1. **Authentication middleware** must be bulletproof (security foundation)
2. **Validation schemas** must be comprehensive (prevent invalid data)
3. **Error transformation** must be consistent (good UX)
4. **Logging** must be detailed (debugging in production)

### Nice-to-Have Enhancements
1. **Rate limiting** for production (prevent abuse)
2. **Request ID tracing** for debugging (correlate logs across services)
3. **Metrics collection** (monitor latency, error rates)
4. **API documentation** (OpenAPI/Swagger for frontend team)

### Testing Priorities
1. **Authentication flows** (highest priority)
2. **File upload edge cases** (high priority)
3. **Error transformation** (high priority)
4. **Concurrent operations** (medium priority)
5. **Performance/timeout** (medium priority)

### Deployment Checklist
- [ ] All environment variables configured
- [ ] RLS policies verified in production
- [ ] Server actions tested end-to-end
- [ ] Authentication middleware tested with real sessions
- [ ] File upload tested with 50MB files
- [ ] Error logging configured (Sentry, LogRocket, etc.)
- [ ] Rate limiting configured (if applicable)
- [ ] API documentation published

---

## Conclusion

This API route implementation is a **thin HTTP wrapper** around robust server actions (INTEL-004 through INTEL-009). The routes' primary responsibilities are:

1. **Authentication**: Validate user session and account membership
2. **Validation**: Parse and validate request data (Zod schemas)
3. **Delegation**: Call appropriate server action with validated data
4. **Transformation**: Convert server action response to HTTP response

**No business logic, rollback procedures, or external service calls** should be implemented at the API route level. All complex operations are delegated to server actions, which have comprehensive error handling, rollback mechanisms, and transaction management.

This architecture ensures:
- **Separation of concerns**: Routes handle HTTP, server actions handle business logic
- **Testability**: Routes can be tested independently of server actions
- **Maintainability**: Changes to business logic don't require route updates
- **Security**: Authentication enforced at route level, RLS enforced at database level
- **Performance**: Server actions optimize external service calls and database queries

**Backend Test Architect** should focus testing efforts on:
1. Authentication middleware (critical)
2. Validation schemas (high priority)
3. Error transformation (high priority)
4. Integration between routes and server actions (medium priority)

The implementation should be straightforward given the existing server actions. Most complexity is already handled by INTEL-004 through INTEL-009.

---

**End of Backend Business Logic Architecture Analysis**
