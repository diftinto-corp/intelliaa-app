import { Prediction } from "@/interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";

interface DocumentType {
  name: string;
  s3_key: string;
  namespace: string;
  id_document: string;
}

interface AssistantData {
  temperature?: number;
  token?: number;
  prompt?: string;
  docs_keys?: DocumentType[];
  keyword_transfer_ws?: any;
  number_transfer_ws?: any;
  namespace?: string;
  voice_assistant?: string;
  document_storage_id?: string;
}

const username = process.env.NEXT_PUBLIC_USERNAME_FLOWISE;
const password = process.env.NEXT_PUBLIC_PASSWORD_FLOWISE;

const AssistantsTemplateList = () => {
  const supabaseClient = createClient();

  try {
    const assistantsTemplate = supabaseClient
      .from("assistants_template")
      .select("*");

    return assistantsTemplate;
  } catch (error) {
    console.error(error);
  }
};

const getTemplate = async (template_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assistants_template")
    .select("*")
    .eq("id", template_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data[0];
};

const GetAllAssistants = async (account_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("account_id", account_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const GetAssistant = async (account_id: string, assistant_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("account_id", account_id)
    .eq("id", assistant_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data[0];
};

const getAssistantByDocumentStorage = async (document_storage_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assistants")
    .select("*")
    .eq("document_storage_id", document_storage_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const NewAssistant = async (
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
        voice_assistant: "StgW6mMosfwXGzfaJ130",
      },
    ])
    .select();

  if (error) {
    return {
      message: error.message,
    };
  }
  return data[0];
};

const updateAssistant = async (
  account_id: string,
  id: string,
  dataAssistant: AssistantData
) => {
  const {
    temperature,
    token,
    prompt,
    docs_keys,
    keyword_transfer_ws,
    number_transfer_ws,
    namespace: currentNamespace,
    voice_assistant,
  } = dataAssistant;

  const supabase = createClient();

  try {
    // Actualizar el asistente
    const { data, error } = await supabase
      .from("assistants")
      .update({
        temperature,
        token,
        prompt,
        docs_keys,
        keyword_transfer_ws,
        number_transfer_ws,
        voice_assistant,
      })
      .eq("account_id", account_id)
      .eq("id", id);

    if (error) {
      throw new Error(`Error updating assistant: ${error.message}`);
    }

    return docs_keys;
  } catch (error) {
    console.error(error);
    return { message: error };
  }
};

const updateAssistantStatusWs = async (
  account_id: string,
  id: string,
  isActive: boolean
) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("assistants")
    .update({
      activated_whatsApp: isActive,
    })
    .eq("account_id", account_id)
    .eq("id", id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const chatPrediction = async (data: Prediction) => {
  console.log("Data:", data);
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}prediction/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_PREDICTION}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al resumir el archivo");
    }

    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const getMessages = async (sessionId: string) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}chatmessage/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_PREDICTION}?sessionId=${sessionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
        },
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al obtener los mensajes");
    }
    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const deleteMessages = async (sessionId: string) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}chatmessage/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_PREDICTION}?sessionId=${sessionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: "Basic " + btoa(username + ":" + password),
        },
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al obtener los mensajes");
    }

    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const activateWs = async (
  assistant_id: string,
  service_id: string,
  urlQr: string,
  keyword_transfer_ws: string
) => {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("assistants")
      .update({
        is_deploying_ws: true,
        service_id_rw: service_id,
        qr_url: urlQr,
        keyword_transfer_ws: keyword_transfer_ws,
      })
      .eq("id", assistant_id)
      .select();

    if (error) {
      console.error("Error updating record:", error);
      return;
    }

    return data[0];
  } catch (e: any) {
    throw new Error(e.message);
  }
};

/**
 * Updates WhatsApp assistant status when deployment succeeds (INT-32)
 * Called by Railway webhook when deployment is complete
 *
 * @param namespace - Assistant namespace
 * @returns Update result
 */
const wsStatusActiveUtil = async (namespace: string) => {
  const supabase = createClient();

  namespace = namespace.replace(/^"(.*)"$/, "$1");

  console.log("[wsStatusActiveUtil] Namespace:", namespace);

  // Verificar si el namespace existe antes de intentar actualizar
  const { data: existingRecords, error: fetchError } = await supabase
    .from("assistants")
    .select("id, account_id, status")
    .eq("namespace", namespace);

  if (fetchError) {
    console.error("[wsStatusActiveUtil] Error fetching record:", fetchError);
    return { error: fetchError.message };
  }

  if (existingRecords.length === 0) {
    console.warn("[wsStatusActiveUtil] No assistant found with namespace:", namespace);
    return { error: "Assistant not found" };
  }

  // Update both legacy fields and new status (INT-32)
  const { data, error } = await supabase
    .from("assistants")
    .update({
      // Legacy fields (backward compatibility)
      activated_whatsApp: true,
      is_deploying_ws: false,
      // New status field (INT-32)
      status: 'active',
      error_message: null,
      last_status_change: new Date().toISOString(),
    })
    .eq("namespace", namespace)
    .select();

  if (error) {
    console.error("[wsStatusActiveUtil] Error updating record:", error);
    return { error: error.message };
  }

  console.log("[wsStatusActiveUtil] Successfully activated WhatsApp for namespace:", namespace);
  return { success: true, data };
};

const deleteDocumentsByNamespace = async (table: string, namespace: string) => {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("metadata->>namespace", namespace)
      .select();

    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      if (data.length === 0) {
        console.log(`No records found in ${table} for namespace ${namespace}`);
      } else {
        console.log(`Deleted records from ${table}:`, data);
      }
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Exception deleting from ${table}:`, e.message);
    return { data: null, error: e.message };
  }
};

const deleteRecordsByNamespace = async (table: string, namespace: string) => {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("namespace", namespace)
      .select();

    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      if (data.length === 0) {
        console.log(`No records found in ${table} for namespace ${namespace}`);
      } else {
        console.log(`Deleted records from ${table}:`, data);
      }
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Exception deleting from ${table}:`, e.message);
    return { data: null, error: e.message };
  }
};

const deleteRecordsByAssistantId = async (
  table: string,
  assistant_id: string
) => {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("assistant_id", assistant_id)
      .select();

    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      if (data.length === 0) {
        console.log(
          `No records found in ${table} for assistant_id ${assistant_id}`
        );
      } else {
        console.log(`Deleted records from ${table}:`, data);
      }
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Exception deleting from ${table}:`, e.message);
    return { data: null, error: e.message };
  }
};

const deleteAssistantWs = async (serviceId: string) => {
  try {
    const response = await fetch(
      "https://52brct.buildship.run/delete-assistant",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceId }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al eliminar el asistente");
    }

    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const deleteAssistant = async (
  assistant_id: string,
  namespace: string,
  serviceId: string,
  accountId: string
) => {
  try {
    // Delete related documents by namespace
    await deleteDocumentsByNamespace("documents", namespace);
    await deleteRecordsByNamespace("qa_docs", namespace);

    // Delete related embedded PDFs by assistant_id
    await deleteRecordsByAssistantId("embedded_pdfs", assistant_id);
    await deleteRecordsByAssistantId("report_ws", assistant_id);

    // Call external service to delete assistant
    await deleteAssistantWs(serviceId);

    // Delete the assistant
    const supabase = createClient();
    const { data, error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", assistant_id)
      .eq("account_id", accountId)
      .select();

    if (error) {
      console.error("Error deleting assistant:", error.message);
    } else {
      if (data.length === 0) {
        console.log(
          `No assistant found with id ${assistant_id} in namespace ${namespace}`
        );
      } else {
        console.log("Assistant deleted:", data);
      }
    }

    return data;
  } catch (e: any) {
    console.error("Unexpected error:", e.message);
    throw new Error(e.message);
  }
};

const getAssistantsVoice = async () => {
  const supabase = createClient();

  const { data, error } = await supabase.from("voice_assistant").select();

  if (error) {
    console.log(`Error fetching assistants in Supabase: ${error.message}`);
    throw new Error(`Error fetching assistants in Supabase: ${error.message}`);
  }

  return data;
};

const purchaseNumber = async (account_id: string) => {
  const supabaseClient = createClient();

  try {
    const activeNumbers = supabaseClient
      .from("active_numbers")
      .select("*")
      .eq("account_id", account_id);

    console.log("Active numbers:", activeNumbers);
    return activeNumbers;
  } catch (error) {
    console.error(error);
  }
};

const getDsAssistant = async (assistant_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .select("*")
    .eq("assistant", assistant_id);

  if (error) {
    console.error(
      "Error getting document storage from assistant:",
      error.message
    );
    throw new Error(
      `Error getting document storage from assistant: ${error.message}`
    );
  }

  return data;
};

const addDsAssistant = async (assistant_id: string, ds_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .insert({
      document_storage: ds_id,
      assistant: assistant_id,
    })
    .select();

  if (error) {
    console.error("Error adding document storage to assistant:", error.message);
    throw new Error(
      `Error adding document storage to assistant: ${error.message}`
    );
  }

  return data;
};

const deleteDsAssistant = async (assistant_id: string, ds_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .delete()
    .eq("assistant", assistant_id)
    .eq("document_storage", ds_id)
    .select();

  if (error) {
    console.error(
      "Error deleting document storage from assistant:",
      error.message
    );
    throw new Error(
      `Error deleting document storage from assistant: ${error.message}`
    );
  }

  return data;
};

const deleteDsAssistantByAssistant = async (assistant_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .delete()
    .eq("assistant", assistant_id)
    .select();

  if (error) {
    console.error(
      "Error deleting document storage from assistant:",
      error.message
    );
    throw new Error(
      `Error deleting document storage from assistant: ${error.message}`
    );
  }

  return data;
};
const updateDsAssistant = async (assistant_id: string, ds_id: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("document_storage-assistants")
    .update({
      document_storage: ds_id,
    })
    .eq("assistant", assistant_id)
    .select();

  if (error) {
    console.log(
      "Error updating document storage from assistant:",
      error.message
    );
    throw new Error(
      `Error updating document storage from assistant: ${error.message}`
    );
  }

  return data;
};

export {
  AssistantsTemplateList,
  NewAssistant,
  GetAllAssistants,
  getTemplate,
  getAssistantByDocumentStorage,
  updateAssistant,
  updateAssistantStatusWs,
  chatPrediction,
  getMessages,
  deleteMessages,
  GetAssistant,
  activateWs,
  wsStatusActiveUtil,
  deleteAssistant,
  getAssistantsVoice,
  purchaseNumber,
  getDsAssistant,
  addDsAssistant,
  deleteDsAssistant,
  deleteDsAssistantByAssistant,
  updateDsAssistant,
};
