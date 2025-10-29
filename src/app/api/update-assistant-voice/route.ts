import { NextResponse, NextRequest } from "next/server";
import { updateAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";
import {
  voiceAssistantUpdateSchema,
  formatValidationError,
} from "@/lib/validation/assistant-config";
import { VapiError, VapiErrorType, isVapiError } from "@/lib/vapi/error-handling";

/**
 * POST /api/update-assistant-voice
 *
 * Updates a voice assistant configuration via VAPI API.
 *
 * Request Body: See voiceAssistantUpdateSchema for validation rules
 *
 * Response:
 * - 200: Assistant updated successfully
 * - 400: Validation error (field-specific errors in response)
 * - 401: VAPI authentication error
 * - 404: Assistant not found in VAPI
 * - 429: VAPI rate limit exceeded
 * - 500: Server error or VAPI unavailable
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Parse request body
    const body = await req.json();

    // Step 2: Validate request with Zod schema
    const validationResult = voiceAssistantUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      // Return 400 with field-specific validation errors
      const formattedErrors = formatValidationError(validationResult.error);

      console.warn('[update-assistant-voice] Validation failed:', {
        fields: Object.keys(formattedErrors.fields),
        errors: formattedErrors.fields,
      });

      return NextResponse.json(
        {
          error: formattedErrors.message,
          fields: formattedErrors.fields,
        },
        { status: 400 }
      );
    }

    // Step 3: Extract validated data
    const validData = validationResult.data;

    console.log('[update-assistant-voice] Request validated successfully:', {
      assistantId: validData.id_assistant,
      vapiId: validData.id_assistant_vapi,
    });

    // Step 4: Call server action with validated data
    const response = await updateAssistantVoiceVapi(
      validData.id_assistant,
      validData.prompt,
      validData.welcomeMessage,
      validData.temperature,
      validData.maxTokens,
      validData.voiceId,
      validData.recordCall,
      validData.backgroundOffice,
      validData.detectEmotion,
      validData.id_assistant_vapi,
      validData.fileIds,
      validData.endCallPhrases,
      validData.endCallMessage,
      validData.voicemailMessage,
      validData.documentStorageId || ''
    );

    // Step 5: Return successful response
    console.log('[update-assistant-voice] Assistant updated successfully:', {
      assistantId: validData.id_assistant,
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    // Handle VapiError with appropriate status codes
    if (isVapiError(error)) {
      console.error('[update-assistant-voice] VAPI error:', {
        type: error.type,
        statusCode: error.statusCode,
        message: error.userMessage,
      });

      // Map VAPI error types to HTTP status codes
      switch (error.type) {
        case VapiErrorType.AUTHENTICATION:
          return NextResponse.json(
            {
              error: 'Error de autenticación',
              message: error.userMessage,
              details: error.details,
            },
            { status: 401 }
          );

        case VapiErrorType.VALIDATION:
          return NextResponse.json(
            {
              error: 'Error de validación',
              message: error.userMessage,
              details: error.details,
            },
            { status: 400 }
          );

        case VapiErrorType.NOT_FOUND:
          return NextResponse.json(
            {
              error: 'Asistente no encontrado',
              message: error.userMessage,
              details: error.details,
            },
            { status: 404 }
          );

        case VapiErrorType.RATE_LIMIT:
          return NextResponse.json(
            {
              error: 'Límite de solicitudes excedido',
              message: error.userMessage,
              details: error.details,
            },
            { status: 429 }
          );

        case VapiErrorType.SERVER_ERROR:
        case VapiErrorType.NETWORK_ERROR:
          return NextResponse.json(
            {
              error: 'Servicio no disponible',
              message: error.userMessage,
              details: error.details,
            },
            { status: 503 }
          );

        default:
          return NextResponse.json(
            {
              error: 'Error desconocido',
              message: error.userMessage,
              details: error.details,
            },
            { status: 500 }
          );
      }
    }

    // Handle generic errors
    console.error('[update-assistant-voice] Unexpected error:', error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Error interno del servidor';

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
