# INTEL-012: Create Document Storage API Routes

**Epic**: Backend Service Migration
**Priority**: P1 - High
**Estimate**: 5 points
**Labels**: backend, api, routes, next-js

## User Story

As a frontend developer, I want API routes for document storage operations, so that I can integrate the new services with the UI components.

## Acceptance Criteria

### AC1: Next.js 15 App Router Pattern
**Given** the API route structure is created
**When** implementing routes
**Then** all routes follow Next.js 15 App Router patterns with proper async request handling

### AC2: Authentication Middleware
**Given** any API route is called
**When** processing the request
**Then** middleware validates user session using Supabase auth before proceeding

### AC3: Multipart Form Data Handling
**Given** file upload routes
**When** processing file uploads
**Then** routes correctly handle multipart/form-data with validation

### AC4: HTTP Status Codes
**Given** any API operation completes
**When** returning responses
**Then** routes return appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 500)

### AC5: Error Response Format
**Given** an error occurs in any route
**When** returning error response
**Then** the response includes structured error object with message and optional details

### AC6: Success Response Format
**Given** an operation succeeds
**When** returning success response
**Then** the response includes necessary data for UI updates and follows consistent format

### AC7: Request Validation
**Given** invalid request data
**When** processing the request
**Then** routes validate input and return 400 Bad Request with validation errors

## Technical Notes

### API Routes to Create/Update

#### 1. Create Document Storage
**Path**: `src/app/api/documents/storage/create/route.ts`
```typescript
POST /api/documents/storage/create
Content-Type: multipart/form-data

Body:
- name: string (required)
- description: string (optional)
- file: File (required, PDF, <50MB)
- account_id: string (required)

Response (201):
{
  success: true,
  data: {
    id: string,
    name: string,
    namespace: string,
    vapiKnowledgeBaseId: string
  }
}

Response (400/500):
{
  success: false,
  error: string,
  details?: any
}
```

#### 2. Add Document to Storage
**Path**: `src/app/api/documents/storage/[storageId]/documents/route.ts`
```typescript
POST /api/documents/storage/{storageId}/documents
Content-Type: multipart/form-data

Body:
- file: File (required, PDF, <50MB)
- account_id: string (required)

Response (201):
{
  success: true,
  data: {
    id: string,
    name: string,
    vapiFileId: string
  }
}
```

#### 3. Delete Document from Storage
**Path**: `src/app/api/documents/storage/[storageId]/documents/[documentId]/route.ts`
```typescript
DELETE /api/documents/storage/{storageId}/documents/{documentId}

Query params:
- account_id: string (required)

Response (200):
{
  success: true,
  storageDeleted?: boolean,
  message: string
}
```

#### 4. Delete Document Storage
**Path**: `src/app/api/documents/storage/[storageId]/route.ts`
```typescript
DELETE /api/documents/storage/{storageId}

Query params:
- account_id: string (required)

Response (200):
{
  success: true,
  message: string
}

Response (409):
{
  success: false,
  error: string,
  assignedAssistants: string[]
}
```

#### 5. Assign Storage to Assistant
**Path**: `src/app/api/assistants/[assistantId]/storage/route.ts`
```typescript
POST /api/assistants/{assistantId}/storage

Body:
{
  storage_id: string,
  account_id: string,
  assistant_type: 'voice' | 'whatsapp'
}

Response (200):
{
  success: true,
  message: string
}
```

#### 6. Unassign Storage from Assistant
**Path**: `src/app/api/assistants/[assistantId]/storage/[storageId]/route.ts`
```typescript
DELETE /api/assistants/{assistantId}/storage/{storageId}

Query params:
- account_id: string (required)

Response (200):
{
  success: true,
  message: string
}
```

### Authentication Middleware

Create reusable auth helper:
```typescript
// src/lib/api/auth.ts
import { createClient } from '@/lib/supabase/server';

export async function authenticateRequest(accountId: string) {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: 'Unauthorized',
      status: 401
    };
  }

  // Verify user is member of account
  const { data: membership } = await supabase
    .from('basejump.account_user')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return {
      error: 'Forbidden: No access to this account',
      status: 403
    };
  }

  return {
    user,
    membership,
    supabase
  };
}
```

### File Upload Handling

```typescript
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const accountId = formData.get('account_id') as string;

    // Validate
    if (!file || !name || !accountId) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > 50 * 1024 * 1024) { // 50MB
      return Response.json(
        { success: false, error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return Response.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Authenticate
    const auth = await authenticateRequest(accountId);
    if (auth.error) {
      return Response.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Process file...
    const result = await createDocumentStorage(accountId, formData);

    return Response.json(
      { success: true, data: result },
      { status: 201 }
    );

  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

### Error Handling Pattern

```typescript
// Standard error response
interface ApiError {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

// Standard success response
interface ApiSuccess<T = any> {
  success: true;
  data?: T;
  message?: string;
}

type ApiResponse<T = any> = ApiSuccess<T> | ApiError;
```

### Request Validation

Use Zod for request validation:
```typescript
import { z } from 'zod';

const createStorageSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  account_id: z.string().uuid(),
  file: z.instanceof(File)
    .refine(file => file.size <= 50 * 1024 * 1024, 'File too large')
    .refine(file => file.type === 'application/pdf', 'Must be PDF')
});

// In route handler
const validation = createStorageSchema.safeParse({
  name,
  description,
  account_id,
  file
});

if (!validation.success) {
  return Response.json(
    {
      success: false,
      error: 'Validation failed',
      details: validation.error.issues
    },
    { status: 400 }
  );
}
```

### Rate Limiting (Optional)

Consider adding rate limiting for API routes:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

// In route handler
const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return Response.json(
    { success: false, error: 'Too many requests' },
    { status: 429 }
  );
}
```

### Timeout Handling

Set timeouts for long-running operations:
```typescript
// Set timeout for document processing
const TIMEOUT = 5 * 60 * 1000; // 5 minutes

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT)
);

const result = await Promise.race([
  createDocumentStorage(accountId, formData),
  timeoutPromise
]);
```

## Definition of Done

- [ ] All API routes created following Next.js 15 patterns
- [ ] Authentication middleware implemented and tested
- [ ] File upload handling implemented
- [ ] Request validation implemented with Zod
- [ ] Error handling consistent across all routes
- [ ] HTTP status codes used correctly
- [ ] Response formats standardized
- [ ] Unit tests for each route
- [ ] Integration tests with real requests
- [ ] API documentation created
- [ ] Postman/Insomnia collection created
- [ ] Code reviewed and approved

## Dependencies

- **Requires**: INTEL-001, INTEL-002, INTEL-003 (services must exist)
- **Requires**: Server actions from INTEL-004 through INTEL-009
- **Requires**: INTEL-011 (environment configuration)

## Related Stories

- **Blocked By**: INTEL-001, INTEL-002, INTEL-003, INTEL-004, INTEL-005, INTEL-006, INTEL-007, INTEL-008, INTEL-009
- **Enables**: Frontend integration of all document features
