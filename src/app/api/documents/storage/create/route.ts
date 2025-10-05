import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromFormData } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { createStorageSchema } from '@/lib/api/validation';
import { createDocumentStorageWithPDF } from '@/lib/actions/intelliaa/documents';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // PHASE 1: Parse FormData
    // =========================================================================
    const formData = await request.formData();

    // =========================================================================
    // PHASE 2: Extract and Validate account_id
    // =========================================================================
    const accountId = extractAccountIdFromFormData(formData);
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
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    const validation = createStorageSchema.safeParse({
      name,
      description,
      account_id: accountId,
      file
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 5: Call Server Action
    // =========================================================================
    const result = await createDocumentStorageWithPDF(formData);

    // =========================================================================
    // PHASE 6: Transform and Return Response
    // =========================================================================
    if (result.success) {
      return successResponse(result.data, 201);
    } else {
      // Extract error details from server action response
      const errorMessage = result.error || 'Error al crear almacenamiento de documentos';
      const statusCode = errorMessage.includes('tardó demasiado') ? 504 : 500;

      return errorResponse(errorMessage, statusCode, result.technicalDetails);
    }

  } catch (error) {
    console.error('[API] /api/documents/storage/create error:', error);

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
