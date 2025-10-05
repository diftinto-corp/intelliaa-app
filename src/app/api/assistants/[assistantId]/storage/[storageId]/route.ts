import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromQuery } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { unassignStorageSchema } from '@/lib/api/validation';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string; storageId: string }> }
) {
  try {
    // =========================================================================
    // PHASE 1: Extract assistantId and storageId from URL params (Next.js 15 async)
    // =========================================================================
    const { assistantId, storageId } = await params;

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
    const validation = unassignStorageSchema.safeParse({
      assistantId,
      storageId,
      accountId
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 5: Perform Unassignment (Database Operation)
    // =========================================================================
    const supabase = await createClient();

    // Check if assignment exists
    const { data: assignment, error: findError } = await supabase
      .from('document_storage-assistants')
      .select('id')
      .eq('assistant_id', assistantId)
      .eq('document_storage_id', storageId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (findError) {
      console.error('[API] Error finding assignment:', findError);
      return errorResponse(
        'Error al buscar asignación',
        500,
        { message: findError.message }
      );
    }

    if (!assignment) {
      return errorResponse(
        'No se encontró la asignación entre el asistente y el almacenamiento',
        404
      );
    }

    // Delete assignment record
    const { error: deleteError } = await supabase
      .from('document_storage-assistants')
      .delete()
      .eq('id', assignment.id);

    if (deleteError) {
      console.error('[API] Error deleting assignment:', deleteError);
      return errorResponse(
        'Error al desasignar almacenamiento del asistente',
        500,
        { message: deleteError.message }
      );
    }

    // =========================================================================
    // PHASE 6: Return Success Response
    // =========================================================================
    return successResponse(
      undefined,
      200,
      'Almacenamiento desasignado correctamente del asistente'
    );

  } catch (error) {
    console.error('[API] /api/assistants/[assistantId]/storage/[storageId] error:', error);

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
