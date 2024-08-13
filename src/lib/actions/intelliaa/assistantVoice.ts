import { createClient } from "@/lib/supabase/server";

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
  const supabase = createClient();
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
            content: prompt,
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
        voiceId: "2d7rEMnN7U2yC7k3Ie3g",
        model: "eleven_multilingual_v2",
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

    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
            prompt: prompt,
            temperature: temperature,
            token: tokens,
            namespace: namespace,
            voice_assistant_id: vapiData.id,
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
  voicemailMessage: string
) => {
  let backgroundSound = "off";

  if (backgroundOffice) {
    backgroundSound = "office";
  }

  const url = `https://api.vapi.ai/assistant/${id_assistant_vapi}`;
  const body = {
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
      knowledgeBase: {
        provider: "canonical",
        topK: 5,
        fileIds: fileIds,
      },
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
    voicemailMessage: voicemailMessage,
  };
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
  };

  console.log(body, id_assistant, id_assistant_vapi);

  try {
    const supabase = createClient();

    const { error } = await supabase
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
      })
      .eq("id", id_assistant);

    if (error) {
      console.log(`Error updating assistant in Supabase: ${error.message}`);
      throw new Error(`Error creating assistant in Supabase: ${error.message}`);
    }

    const response = await fetch(url, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers,
    });

    if (!response.ok) {
      console.log(`Error updating assistant in VAPI: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const vapiData = await response.json();

    console.log(vapiData);

    return vapiData;
  } catch (apiError) {
    throw apiError; // Re-lanzamos el error después de loguearlo para que el llamador lo maneje si es necesario
  }
};

const deleteAssistantVoice = async (
  assistant_id: string,
  voice_assistant_id: string,
  accountId: string
) => {
  try {
    // Primero eliminamos el asistente de Supabase
    const supabase = createClient();
    const { data, error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", assistant_id)
      .eq("account_id", accountId)
      .select();

    if (error) {
      throw new Error(
        `Error deleting assistant from Supabase: ${error.message}`
      );
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

    const supabase = createClient();

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
