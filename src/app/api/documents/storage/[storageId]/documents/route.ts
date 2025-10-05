import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromFormData } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { addDocumentSchema } from '@/lib/api/validation';
import { uploadPdfToExistingStorage } from '@/lib/actions/intelliaa/documents';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storageId: string }> }
) {
  try {
    // =========================================================================
    // PHASE 1: Extract storageId from URL params (Next.js 15 async)
    // =========================================================================
    const { storageId } = await params;

    // =========================================================================
    // PHASE 2: Parse FormData
    // =========================================================================
    const formData = await request.formData();

    // Add storageId to formData for server action
    formData.append('document_storage_id', storageId);

    // =========================================================================
    // PHASE 3: Extract and Validate account_id
    // =========================================================================
    const accountId = extractAccountIdFromFormData(formData);
    if (!accountId) {
      return errorResponse('El ID de cuenta es requerido', 400);
    }

    // =========================================================================
    // PHASE 4: Authenticate User and Validate Account Membership
    // =========================================================================
    const auth = await authenticateRequest(accountId);
    if (!auth.success) {
      return errorResponse(auth.error, auth.status);
    }

    // =========================================================================
    // PHASE 5: Validate Input with Zod
    // =========================================================================
    const file = formData.get('file') as File;

    const validation = addDocumentSchema.safeParse({
      storageId,
      accountId,
      file
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 6: Call Server Action
    // =========================================================================
    const result = await uploadPdfToExistingStorage(formData);

    // =========================================================================
    // PHASE 7: Transform and Return Response
    // =========================================================================
    if (result.success) {
      return successResponse(result.data, 201);
    } else {
      const errorMessage = result.error || 'Error al añadir documento al almacenamiento';

      // Handle specific error codes
      let statusCode = 500;
      if (errorMessage.includes('tardó demasiado')) {
        statusCode = 504;
      } else if (errorMessage.includes('conflicto') || errorMessage.includes('operando')) {
        statusCode = 409;
      } else if (errorMessage.includes('no encontrad')) {
        statusCode = 404;
      }

      return errorResponse(errorMessage, statusCode, result.technicalDetails);
    }

  } catch (error) {
    console.error('[API] /api/documents/storage/[storageId]/documents error:', error);

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
