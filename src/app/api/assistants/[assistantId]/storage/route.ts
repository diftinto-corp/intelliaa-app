import { NextRequest } from 'next/server';
import { authenticateRequest, extractAccountIdFromJSON } from '@/lib/api/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api/responses';
import { assignStorageSchema } from '@/lib/api/validation';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  try {
    // =========================================================================
    // PHASE 1: Extract assistantId from URL params (Next.js 15 async)
    // =========================================================================
    const { assistantId } = await params;

    // =========================================================================
    // PHASE 2: Parse JSON Body
    // =========================================================================
    const body = await request.json();
    const { storage_id, account_id, assistant_type } = body;

    // =========================================================================
    // PHASE 3: Validate account_id
    // =========================================================================
    if (!account_id) {
      return errorResponse('El ID de cuenta es requerido', 400);
    }

    // =========================================================================
    // PHASE 4: Authenticate User and Validate Account Membership
    // =========================================================================
    const auth = await authenticateRequest(account_id);
    if (!auth.success) {
      return errorResponse(auth.error, auth.status);
    }

    // =========================================================================
    // PHASE 5: Validate Input with Zod
    // =========================================================================
    const validation = assignStorageSchema.safeParse({
      assistantId,
      storage_id,
      account_id,
      assistant_type
    });

    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }

    // =========================================================================
    // PHASE 6: Perform Assignment (Database Operation)
    // =========================================================================
    const supabase = await createClient();

    // Check if assistant exists and belongs to account
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('id, name')
      .eq('id', assistantId)
      .eq('account_id', account_id)
      .single();

    if (assistantError || !assistant) {
      return errorResponse('Asistente no encontrado', 404);
    }

    // Check if storage exists and belongs to account
    const { data: storage, error: storageError } = await supabase
      .from('document_storages')
      .select('id, name')
      .eq('id', storage_id)
      .eq('account_id', account_id)
      .single();

    if (storageError || !storage) {
      return errorResponse('Almacenamiento no encontrado', 404);
    }

    // Check if already assigned (to avoid duplicates)
    const { data: existing } = await supabase
      .from('document_storage-assistants')
      .select('id')
      .eq('assistant_id', assistantId)
      .eq('document_storage_id', storage_id)
      .maybeSingle();

    if (existing) {
      return successResponse(
        undefined,
        200,
        'El almacenamiento ya está asignado a este asistente'
      );
    }

    // Create assignment record
    const { error: insertError } = await supabase
      .from('document_storage-assistants')
      .insert({
        assistant_id: assistantId,
        document_storage_id: storage_id,
        account_id: account_id
      });

    if (insertError) {
      console.error('[API] Error creating assignment:', insertError);
      return errorResponse(
        'Error al asignar almacenamiento al asistente',
        500,
        { message: insertError.message }
      );
    }

    // =========================================================================
    // PHASE 7: Return Success Response
    // =========================================================================
    return successResponse(
      undefined,
      200,
      `Almacenamiento "${storage.name}" asignado correctamente a "${assistant.name}"`
    );

  } catch (error) {
    console.error('[API] /api/assistants/[assistantId]/storage error:', error);

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
