import { createClient } from "@/lib/supabase/server";

const createAssistantVoiceVapi = async (
  account_id: string,
  name: string,
  type: string,
  template_id: string,
  prompt: string,
  temperature: number,
  tokens: number
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
        provider: "openai",
        model: "gpt-4o-mini",
      },
      voice: {
        provider: "11labs",
        voiceId: "2d7rEMnN7U2yC7k3Ie3g",
        model: "eleven_multilingual_v2",
      },
      voicemailDetection: {
        provider: "twilio",
      },
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
  fileIds: string[]
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

export {
  createAssistantVoiceVapi,
  updateAssistantVoiceVapi,
  deleteAssistantVoice,
};
