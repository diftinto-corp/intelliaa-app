import { createClient } from "@/lib/supabase/server";
import {
  listVapiKnowledgeBases,
  getQueryToolForKB,
} from "./vapiKnowledgeBase";
import {
  callVapiWithRetry,
  parseVapiError,
  VapiError,
} from "@/lib/vapi/error-handling";

/**
 * Check if VAPI Knowledge Base feature is enabled
 * INTEL-002: Feature flag for gradual rollout
 */
function shouldUseVapiKB(): boolean {
  return process.env.NEXT_PUBLIC_USE_VAPI_KB === 'true';
}

/**
 * Get query tools for assistant based on VAPI KBs
 * INTEL-002: Builds tools array for VAPI assistant configuration
 */
async function getVapiKBToolsForAssistant(
  accountId: string,
  documentStorageName?: string
): Promise<any[]> {
  if (!shouldUseVapiKB()) {
    return [];
  }

  try {
    // List all active KBs for this account
    const kbsResult = await listVapiKnowledgeBases({
      accountId,
      status: 'active',
    });

    if (!kbsResult.success || !kbsResult.data || kbsResult.data.length === 0) {
      console.log('[INTEL-002] No VAPI KBs found for assistant');
      return [];
    }

    // Filter by document storage name if provided
    let relevantKBs = kbsResult.data;
    if (documentStorageName) {
      relevantKBs = kbsResult.data.filter(
        kb => kb.name === `KB: ${documentStorageName}`
      );
    }

    // Build tools array
    const tools = await Promise.all(
      relevantKBs.map(async (kb) => {
        const toolResult = await getQueryToolForKB(kb.id);
        return toolResult.success ? toolResult.data : null;
      })
    );

    return tools.filter(tool => tool !== null);
  } catch (error) {
    console.error('[INTEL-002] Error getting VAPI KB tools:', error);
    return [];
  }
}

const createAssistantVoiceVapi = async (
  account_id: string,
  name: string,
  type: string,
  template_id: string,
  prompt: string,
  temperature: number,
  tokens: number,
  firstMessage: string
) => {
  const supabase = await createClient();
  const namespace = `${Math.random().toString(36).substring(2, 15)}`;

  try {
    const url = "https://api.vapi.ai/assistant";
    const body = {
      name: name,
      transcriber: {
        provider: "deepgram",
        model: "nova-2-general",
        language: "es",
      },
      model: {
        messages: [
          {
            content: `${prompt} Cuando se te pida transferir pidele confirmación al usuario que desea ser transferido y si la respuesta es afirmativa usa la función transferCall y cuando el usuario se despida pidele confirmación al usuario que quiere finalizar si la respuesta es afirmativa, usa la función endCall.`,
            role: "system",
          },
        ],
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: temperature,
        maxTokens: tokens,
        emotionRecognitionEnabled: true,
      },
      voice: {
        provider: "11labs",
        voiceId: "26MYCwqeqFSxt1nT7VgZ",
        model: "eleven_flash_v2_5",
      },
      firstMessage: firstMessage,
      voicemailDetection: {
        provider: "twilio",
      },
      backgroundSound: "office",
      endCallFunctionEnabled: true,
      endCallMessage: "Hasta luego, gracias por usar nuestro servicio",
      endCallPhrases: [
        "hasta luego",
        "adios",
        "chao",
        "bye",
        "bye bye",
        "hasta pronto",
      ],
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
    };

    console.log('[createAssistantVoiceVapi] Creating assistant with payload:', JSON.stringify(body, null, 2));

    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      });

      if (!response.ok) {
        // Parse error response for better debugging
        const errorData = await response.json().catch(() => null);
        console.error('[createAssistantVoiceVapi] VAPI error response:', errorData);
        throw new Error(
          `VAPI API error (${response.status}): ${errorData?.message || JSON.stringify(errorData) || response.statusText}`
        );
      }

      const vapiData = await response.json();

      const { data, error } = await supabase
        .from("assistants")
        .insert([
          {
            account_id,
            name,
            type_assistant: type,
            template_id: template_id,
            prompt: `${prompt} Cuando se te pida transferir, usa la función transferCall y cuando el usuario se despida, usa la función endCall.`,
            temperature: temperature,
            token: tokens,
            namespace: namespace,
            voice_assistant_id: vapiData.id,
            voice_assistant: "26MYCwqeqFSxt1nT7VgZ",
            detect_emotion: true,
            background_office: true,
            end_call_phrases: [
              "hasta luego",
              "adios",
              "chao",
              "bye",
              "bye bye",
              "hasta pronto",
            ],
            end_call_message: "Hasta luego, gracias por usar nuestro servicio",
          },
        ])
        .select();

      if (error) {
        throw new Error(
          `Error creating assistant in Supabase: ${error.message}`
        );
      }

      return vapiData;
    } catch (apiError) {
      throw apiError; // Re-lanzamos el error después de loguearlo para que el llamador lo maneje si es necesario
    }
  } catch (dbError) {
    throw dbError; // Re-lanzamos el error después de loguearlo para que el llamador lo maneje si es necesario
  }
};

/**
 * Updates a voice assistant in both VAPI and Supabase
 *
 * CRITICAL FIX (INT-34 Day 3):
 * - Updates VAPI FIRST (source of truth)
 * - Updates Supabase SECOND (local database)
 * - Includes rollback mechanism if Supabase update fails
 * - Uses retry logic for transient VAPI failures
 *
 * Previous implementation updated Supabase first, causing data inconsistency
 * if VAPI update failed. This version ensures VAPI is always authoritative.
 *
 * @param id_assistant - Supabase assistant ID
 * @param prompt - System prompt for the AI
 * @param welcomeMessage - First message spoken by assistant
 * @param temperature - Model temperature (0.0-2.0)
 * @param maxTokens - Maximum tokens per response (50-4000)
 * @param voiceId - ElevenLabs voice ID
 * @param recordCall - Whether to record calls
 * @param backgroundOffice - Whether to use office background sound
 * @param detectEmotion - Whether to enable emotion recognition
 * @param id_assistant_vapi - VAPI assistant ID
 * @param fileIds - Array of VAPI file IDs for knowledge base
 * @param endCallPhrases - Phrases that trigger call end
 * @param endCallMessage - Message spoken when call ends
 * @param voicemailMessage - Message left on voicemail
 * @param documentStorageId - ID of linked document storage
 * @returns VAPI assistant data
 * @throws VapiError with user-friendly message on failure
 */
const updateAssistantVoiceVapi = async (
  id_assistant: string,
  prompt: string,
  welcomeMessage: string,
  temperature: number,
  maxTokens: number,
  voiceId: string,
  recordCall: boolean,
  backgroundOffice: boolean,
  detectEmotion: boolean,
  id_assistant_vapi: string,
  fileIds: string[],
  endCallPhrases: string[],
  endCallMessage: string,
  voicemailMessage: string,
  documentStorageId: string
) => {
  const supabase = await createClient();

  // Step 1: Get current assistant data for context and potential rollback
  const { data: assistantData, error: fetchError } = await supabase
    .from("assistants")
    .select("account_id, prompt, temperature, token, welcome_assistant, voice_assistant, record_call, detect_emotion, background_office")
    .eq("id", id_assistant)
    .single();

  if (fetchError || !assistantData) {
    throw new Error('Asistente no encontrado o acceso denegado');
  }

  // Store previous state for potential rollback
  const previousState = {
    prompt: assistantData.prompt,
    temperature: assistantData.temperature,
    maxTokens: assistantData.token,
    welcomeMessage: assistantData.welcome_assistant,
    voiceId: assistantData.voice_assistant,
    recordCall: assistantData.record_call,
    detectEmotion: assistantData.detect_emotion,
    backgroundOffice: assistantData.background_office,
  };

  console.log('[updateAssistantVoiceVapi] Previous state stored for rollback');

  // Step 2: Get VAPI KB tools if feature is enabled (INTEL-002)
  const vapiKBTools = await getVapiKBToolsForAssistant(
    assistantData.account_id,
    documentStorageId
  );
  const useVapiKB = shouldUseVapiKB() && vapiKBTools.length > 0;

  console.log(`[INTEL-002] VAPI KB feature enabled: ${useVapiKB}, tools count: ${vapiKBTools.length}`);

  // Step 3: Prepare VAPI request body
  const backgroundSound = backgroundOffice ? "office" : "off";
  const url = `https://api.vapi.ai/assistant/${id_assistant_vapi}`;

  const body: any = {
    model: {
      messages: [
        {
          content: prompt,
          role: "system",
        },
      ],
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: temperature,
      maxTokens: maxTokens,
      emotionRecognitionEnabled: detectEmotion,
    },
    voice: {
      provider: "11labs",
      voiceId: voiceId,
      model: "eleven_multilingual_v2",
    },
    recordingEnabled: recordCall,
    firstMessage: welcomeMessage,
    backgroundSound: backgroundSound,
    voicemailDetection: {
      provider: "twilio",
    },
    endCallPhrases: endCallPhrases,
    endCallMessage: endCallMessage,
  };

  // INTEL-002: Use VAPI KB tools if available, otherwise use legacy knowledgeBase
  if (useVapiKB) {
    console.log('[INTEL-002] Using VAPI KB tools configuration');
    body.tools = vapiKBTools;
  } else {
    console.log('[INTEL-002] Using legacy knowledgeBase configuration');
    body.model.knowledgeBase = {
      provider: "canonical",
      topK: 5,
      fileIds: fileIds,
    };
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
  };

  // Step 4: UPDATE VAPI FIRST (source of truth) with retry logic
  let vapiResult;
  try {
    vapiResult = await callVapiWithRetry(
      async () => {
        const response = await fetch(url, {
          method: "PATCH",
          body: JSON.stringify(body),
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw parseVapiError(response, errorData);
        }

        return await response.json();
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error, delay) => {
          console.warn(
            `[updateAssistantVoiceVapi] VAPI update attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`,
            error instanceof VapiError ? error.type : error
          );
        },
      }
    );

    console.log('[updateAssistantVoiceVapi] VAPI update successful:', vapiResult.id);

  } catch (error) {
    console.error('[updateAssistantVoiceVapi] VAPI update failed after retries:', error);

    // Throw user-friendly error
    if (error instanceof VapiError) {
      throw error;
    }

    throw new VapiError(
      'NETWORK_ERROR' as any,
      0,
      error,
      'No se pudo conectar al servicio de voz. Por favor, verifique su conexión.'
    );
  }

  // Step 5: UPDATE SUPABASE (local database)
  try {
    const { error: updateError } = await supabase
      .from("assistants")
      .update({
        prompt,
        temperature,
        token: maxTokens,
        welcome_assistant: welcomeMessage,
        voice_assistant: voiceId,
        record_call: recordCall,
        detect_emotion: detectEmotion,
        background_office: backgroundOffice,
        documents_vapi: fileIds,
        end_call_phrases: endCallPhrases,
        end_call_message: endCallMessage,
        voicemail_message: voicemailMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id_assistant);

    if (updateError) {
      console.error(
        '[updateAssistantVoiceVapi] Supabase update failed, attempting VAPI rollback:',
        updateError
      );

      // Step 6: ROLLBACK VAPI if Supabase update fails
      try {
        const rollbackBody = {
          model: {
            messages: [{ content: previousState.prompt, role: "system" }],
            temperature: previousState.temperature,
            maxTokens: previousState.maxTokens,
            emotionRecognitionEnabled: previousState.detectEmotion,
          },
          voice: {
            provider: "11labs",
            voiceId: previousState.voiceId,
            model: "eleven_multilingual_v2",
          },
          recordingEnabled: previousState.recordCall,
          firstMessage: previousState.welcomeMessage,
          backgroundSound: previousState.backgroundOffice ? "office" : "off",
        };

        await fetch(url, {
          method: "PATCH",
          body: JSON.stringify(rollbackBody),
          headers,
        });

        console.log('[updateAssistantVoiceVapi] VAPI rollback successful');

      } catch (rollbackError) {
        // CRITICAL ERROR: Log for manual intervention
        console.error(
          '[updateAssistantVoiceVapi] CRITICAL: VAPI rollback failed',
          {
            assistantId: id_assistant,
            vapiId: id_assistant_vapi,
            error: rollbackError,
            previousState,
          }
        );

        // TODO: Send alert to monitoring system
        // await sendCriticalAlert('VAPI_ROLLBACK_FAILED', { assistantId, vapiId });
      }

      throw new Error(`Error al actualizar la base de datos: ${updateError.message}`);
    }

    console.log('[updateAssistantVoiceVapi] Full update successful');
    return vapiResult;

  } catch (error) {
    console.error('[updateAssistantVoiceVapi] Unexpected error:', error);
    throw error;
  }
};

const deleteAssistantVoice = async (
  assistant_id: string,
  voice_assistant_id: string,
  accountId: string,
  documentStorageId: string
) => {
  try {
    // Primero eliminamos el asistente de Supabase
    const supabase = await createClient();

    const { data: documentStorage, error: errorDocumentStorage } =
      await supabase
        .from("document_storage-assistants")
        .delete()
        .eq("document_storage", documentStorageId)
        .select();

    const { data, error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", assistant_id)
      .eq("account_id", accountId)
      .select();

    if (errorDocumentStorage) {
      console.log(
        `Error deleting document storage from Supabase: ${errorDocumentStorage.message}`
      );
      throw new Error(
        `Error deleting document storage from Supabase: ${errorDocumentStorage.message}`
      );
    }

    if (error) {
      throw new Error(
        `Error deleting assistant from Supabase: ${error.message}`
      );
    }

    if (documentStorage.length === 0) {
      return {
        status: "error",
        message: `No document storage found with id ${documentStorageId}`,
      };
    } else {
      console.log("Document storage deleted from Supabase:", documentStorage);
    }

    if (data.length === 0) {
      return {
        status: "error",
        message: `No assistant found with id ${assistant_id}`,
      };
    } else {
      console.log("Assistant deleted from Supabase:", data);
    }

    // Si la eliminación en Supabase es exitosa, procedemos a eliminar el asistente de VAPI
    const vapiOptions = {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
      },
    };

    const vapiResponse = await fetch(
      `https://api.vapi.ai/assistant/${voice_assistant_id}`,
      vapiOptions
    );
    const vapiResult = await vapiResponse.json();

    if (!vapiResponse.ok) {
      throw new Error(
        `Error deleting assistant from VAPI: ${
          vapiResult.message || "Unknown error"
        }`
      );
    }

    console.log("Assistant deleted from VAPI:", vapiResult);

    return {
      status: "success",
      message: "Assistant deleted successfully from Supabase and VAPI",
      data: {
        supabase: data,
        vapi: vapiResult,
      },
    };
  } catch (e: any) {
    console.error("Unexpected error:", e.message);
    return {
      status: "error",
      message: `Error deleting assistant: ${e.message}`,
    };
  }
};

const updateNumerAssistant = async (
  id_assistant: string,
  vapi_id_assistant: string,
  name_assistant: string,
  id_number_vapi: string,
  account_id: string
) => {
  console.log(
    "updateNumerAssistant",
    id_assistant,
    vapi_id_assistant,
    name_assistant,
    id_number_vapi,
    account_id
  );
  const url = `https://api.vapi.ai/phone-number/${id_number_vapi}`;
  const body = {
    assistantId: vapi_id_assistant,
  };
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
  };

  try {
    const response = await fetch(url, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers,
    });

    console.log("VAPI response status:", response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const vapiData = await response.json();
    console.log("VAPI data:", vapiData);

    const supabase = await createClient();

    const { data: updateActiveNumber, error: errorActiveNumber } =
      await supabase
        .from("active_numbers")
        .update({
          id_assistant,
          name_assistant,
          id_number_vapi,
        })
        .eq("account_id", account_id)
        .eq("id_number_vapi", id_number_vapi)
        .select();

    if (errorActiveNumber) {
      console.log(
        `Error updating number in Supabase: ${errorActiveNumber.message}`
      );
      throw new Error(
        `Error updating number in Supabase: ${errorActiveNumber.message}`
      );
    }

    console.log(updateActiveNumber);

    let activeNumber;
    if (
      updateActiveNumber[0].id_assistant !== "" &&
      updateActiveNumber[0].name_assistant !== ""
    ) {
      console.log("Estan activos");
      activeNumber = true;
    } else {
      console.log("No estan activos");
      activeNumber = false;
    }

    console.log(activeNumber);
    console.log(typeof activeNumber);
    console.log(id_assistant);

    return vapiData;
  } catch (e: any) {
    console.error("Error in updateNumerNumber:", e);
    throw e;
  }
};

const updateNumberActive = async (
  id_number_vapi: string,
  number_transfer: string,
  voice_assistant_id: string
) => {
  console.log(id_number_vapi, number_transfer, voice_assistant_id);

  const url1 = `https://api.vapi.ai/phone-number/${id_number_vapi}`;
  const body1 = {
    assistantId: voice_assistant_id,
  };

  const url2 = `https://api.vapi.ai/assistant/${voice_assistant_id}`;
  const body2 = {
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
    },
    endCallFunctionEnabled: true,
    forwardingPhoneNumber: number_transfer,
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
  };

  try {
    // Realiza la primera solicitud a VAPI
    const response1 = await fetch(url1, {
      method: "PATCH",
      body: JSON.stringify(body1),
      headers,
    });

    console.log(
      "VAPI response status (fallbackDestination):",
      response1.status
    );
    if (!response1.ok) {
      throw new Error(
        `HTTP error in fallbackDestination update! status: ${response1.status}`
      );
    }

    const vapiData1 = await response1.json();
    console.log("VAPI data (fallbackDestination):", vapiData1);

    // Realiza la segunda solicitud a VAPI
    const response2 = await fetch(url2, {
      method: "PATCH",
      body: JSON.stringify(body2),
      headers,
    });

    console.log(
      "VAPI response status (forwardingPhoneNumber):",
      response2.status
    );
    if (!response2.ok) {
      throw new Error(
        `HTTP error in forwardingPhoneNumber update! status: ${response2.status}`
      );
    }

    const vapiData2 = await response2.json();
    console.log("VAPI data (forwardingPhoneNumber):", vapiData2);

    // Retorna ambos resultados en un objeto
    return {
      fallbackDestinationUpdate: vapiData1,
      forwardingPhoneNumberUpdate: vapiData2,
    };
  } catch (e: any) {
    console.error("Error in updateNumberActive:", e);
    throw e;
  }
};

const makeCallAssistant = async (
  id_number_vapi: string,
  voice_assistant_id: string,
  numberTocall: string
) => {
  console.log(
    "makeCallAssistant",
    id_number_vapi,
    voice_assistant_id,
    numberTocall
  );

  try {
    const url = "https://api.vapi.ai/call";
    const body = {
      phoneNumberId: id_number_vapi,
      assistantId: voice_assistant_id,
      customer: {
        number: numberTocall,
      },
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
    };

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });

    if (!response.ok) {
      console.log(`Error making call: ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const vapiData = await response.json();

    return vapiData;
  } catch (e: any) {
    console.error("Error in makeCallAssistant:", e);
    throw e;
  }
};

export {
  createAssistantVoiceVapi,
  updateAssistantVoiceVapi,
  deleteAssistantVoice,
  updateNumerAssistant,
  updateNumberActive,
  makeCallAssistant,
};
