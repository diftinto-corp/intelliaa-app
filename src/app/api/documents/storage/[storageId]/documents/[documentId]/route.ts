import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromQuery } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { deleteDocumentSchema } from '@/lib/api/validation';
import { deletePdfDocument } from '@/lib/actions/intelliaa/documents';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storageId: string; documentId: string }> }
) {
  try {
    // =========================================================================
    // PHASE 1: Extract storageId and documentId from URL params (Next.js 15 async)
    // =========================================================================
    const { storageId, documentId } = await params;

    // =========================================================================
    // PHASE 2: Extract account_id from Query Params
    // =========================================================================
    const accountId = extractAccountIdFromQuery(request);
    if (!accountId) {
      return errorResponse('El ID de cuenta es requerido', 400);
    }

    // =========================================================================
    // PHASE 3: Authenticate User and Validate Account Membership
    // =========================================================================
    const auth = await authenticateRequest(accountId);
    if (!auth.success) {
      return errorResponse(auth.error, auth.status);
    }

    // =========================================================================
    // PHASE 4: Validate Input with Zod
    // =========================================================================
    const validation = deleteDocumentSchema.safeParse({
      storageId,
      documentId,
      accountId
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 5: Call Server Action
    // =========================================================================
    const result = await deletePdfDocument(storageId, documentId, accountId);

    // =========================================================================
    // PHASE 6: Transform and Return Response
    // =========================================================================
    if (result.status === 'success') {
      const warnings = result.warnings || [];
      return successResponse(
        {
          storageDeleted: result.storageDeleted || false,
        },
        200,
        result.message,
        warnings
      );
    } else {
      const errorMessage = result.message || 'Error al eliminar documento';

      // Determine status code based on error message
      let statusCode = 500;
      if (errorMessage.includes('no encontrad')) {
        statusCode = 404;
      } else if (errorMessage.includes('conflicto') || errorMessage.includes('operando')) {
        statusCode = 409;
      }

      return errorResponse(errorMessage, statusCode);
    }

  } catch (error) {
    console.error('[API] /api/documents/storage/[storageId]/documents/[documentId] error:', error);

    if (error instanceof Error) {
      return errorResponse(
        'Error interno del servidor',
        500,
        { message: error.message }
      );
    }

    return errorResponse('Error desconocido', 500);
  }
}
