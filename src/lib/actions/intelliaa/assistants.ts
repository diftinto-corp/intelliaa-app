import { Prediction } from "@/interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";

import {
  deleteDocuments,
  deleteEmbedPDF,
  newEmbedPDF,
  upsertPDF,
} from "./documents";
import { json } from "stream/consumers";

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
  dataAssistant: AssistantData,
  bdDocd_keys: DocumentType[]
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

  const upsertPDFs = async (
    s3_key: string,
    id_document: string,
    namespaceDoc: string
  ) => {
    try {
      await upsertPDF(s3_key, id_document, namespaceDoc);
      await newEmbedPDF(account_id, id, s3_key, id_document);
    } catch (error) {
      console.error(`Error upserting PDF: ${id_document}`, error);
    }
  };

  const deletePdfs = async (id_document: string, namespaceDoc: string) => {
    try {
      await deleteDocuments(id_document, namespaceDoc);
      await deleteEmbedPDF(account_id, id, id_document);
    } catch (error) {
      console.error(`Error deleting PDF: ${id_document}`, error);
    }
  };

  const syncArrays = async () => {
    if (!docs_keys) return;

    // Determinar documentos a añadir y a eliminar
    const toAdd = docs_keys.filter(
      (stateDoc) =>
        stateDoc.namespace === currentNamespace &&
        !bdDocd_keys.some(
          (bdDoc) =>
            bdDoc.s3_key === stateDoc.s3_key &&
            bdDoc.id_document === stateDoc.id_document &&
            bdDoc.namespace === stateDoc.namespace
        )
    );

    const toDelete = bdDocd_keys.filter(
      (dbDoc) =>
        dbDoc.namespace === currentNamespace &&
        !docs_keys.some(
          (stateDoc) =>
            stateDoc.s3_key === dbDoc.s3_key &&
            stateDoc.id_document === dbDoc.id_document &&
            stateDoc.namespace === dbDoc.namespace
        )
    );

    // Primero eliminar los documentos
    const deletePromises = toDelete.map((doc) =>
      deletePdfs(doc.id_document, doc.namespace)
    );

    await Promise.all(deletePromises);

    // Luego añadir los documentos
    const addPromises = toAdd.map((doc) =>
      upsertPDFs(doc.s3_key, doc.id_document, doc.namespace)
    );

    await Promise.all(addPromises);

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
  };

  try {
    // Sincronizar documentos antes de actualizar el asistente
    if (docs_keys) {
      await syncArrays();
      return docs_keys;
    } else {
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
      return [];
    }
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

const wsStatusActiveUtil = async (namespace: string) => {
  const supabase = createClient();

  namespace = namespace.replace(/^"(.*)"$/, "$1");

  // Verificar si el namespace existe antes de intentar actualizar
  const { data: existingRecords, error: fetchError } = await supabase
    .from("assistants")
    .select("*")
    .eq("namespace", namespace);

  if (fetchError) {
    console.error("Error fetching record:", fetchError);
    return;
  }

  if (existingRecords.length === 0) {
    return;
  }

  // Intentar actualizar el registro
  const { data, error } = await supabase
    .from("assistants")
    .update({
      activated_whatsApp: true,
      is_deploying_ws: false,
    })
    .eq("namespace", namespace);

  if (error) {
    console.error("Error updating record:", error);
  } else {
    return data;
  }
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

  console.log("Data:", data);

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

export {
  AssistantsTemplateList,
  NewAssistant,
  GetAllAssistants,
  getTemplate,
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
};
