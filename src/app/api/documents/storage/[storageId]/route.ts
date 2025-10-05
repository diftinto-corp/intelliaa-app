import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromQuery } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { deleteStorageSchema } from '@/lib/api/validation';
import { deleteDocumentStorageWithValidation } from '@/lib/actions/intelliaa/documents';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storageId: string }> }
) {
  try {
    // =========================================================================
    // PHASE 1: Extract storageId from URL params (Next.js 15 async)
    // =========================================================================
    const { storageId } = await params;

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
    const validation = deleteStorageSchema.safeParse({
      storageId,
      accountId
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 5: Call Server Action
    // =========================================================================
    const result = await deleteDocumentStorageWithValidation(storageId, accountId);

    // =========================================================================
    // PHASE 6: Transform and Return Response
    // =========================================================================
    if (result.success) {
      const warnings = result.warnings || [];
      return successResponse(
        result.deleted,
        200,
        'Almacenamiento eliminado correctamente',
        warnings
      );
    } else {
      const errorMessage = result.error?.message || 'Error al eliminar almacenamiento';
      const errorDetails = result.error?.details;

      // Handle specific error codes
      let statusCode = 500;
      if (result.error?.code === 'NOT_FOUND') {
        statusCode = 404;
      } else if (result.error?.code === 'LOCK_ACQUISITION_FAILED') {
        statusCode = 409;
      } else if (result.error?.code === 'ASSIGNED_TO_ASSISTANTS') {
        // Storage is assigned to assistants - conflict
        return errorResponse(
          errorMessage,
          409,
          result.error.details,
          'ASSIGNED_TO_ASSISTANTS'
        );
      }

      return errorResponse(errorMessage, statusCode, errorDetails, result.error?.code);
    }

  } catch (error) {
    console.error('[API] /api/documents/storage/[storageId] error:', error);

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
