"use_server";

import { createClient } from "@/lib/supabase/client";

const addQa = async (
  account_id: string,
  assistant_id: string,
  formData: FormData,
  namespace: string,
  id_document: string
) => {
  const supabase = createClient();

  const { data, error } = await supabase.from("qa_docs").insert([
    {
      account_id,
      assistant_id,
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      namespace,
      id_document,
    },
  ]);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const updateQa = async (
  account_id: string,
  question: string,
  answer: string,
  id: string
) => {
  const supabase = createClient();

  if (!question || !answer) {
    return {
      message: "Question o answer son inválidos",
    };
  }

  const { data, error } = await supabase
    .from("qa_docs")
    .update({
      question: question,
      answer: answer,
    })
    .eq("id", id)
    .eq("account_id", account_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const getAllQa = async (assistant_id: string) => {
  const supabase = createClient();
  if (!assistant_id) return [];

  const { data, error } = await supabase
    .from("qa_docs")
    .select("*")
    .eq("assistant_id", assistant_id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
};

const getQa = async (id: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("qa_docs")
    .select("*")
    .eq("id", id);

  if (error) {
    return {
      message: error.message,
    };
  }

  return data[0];
};

const deleteQa = async (account_id: string, id: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("qa_docs")
    .delete()
    .eq("id", id)
    .eq("account_id", account_id);

  if (error) {
    console.log("Error al eliminar la pregunta y respuesta:", error);
    return {
      message: error.message,
    };
  }

  return data;
};

const upsertQa = async (
  answer: string,
  namespace: string,
  id_document: string,
  question: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}vector/upsert/${process.env.NEXT_PUBLIC_FLOWISE_CHATID_UPSERTQA}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrideConfig: {
            text: answer,

            metadata: {
              namespace: namespace,
              id_document: id_document,
              question: question,
            },
          },
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al subir la pregunta y respuesta");
    }
    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

const deleteDocuments = async (
  id_document: string,
  namespace: string
): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("metadata->>id_document", id_document)
    .eq("metadata->>namespace", namespace);

  if (error) {
    console.error("Error al eliminar el documento:", error);
    return false;
  }

  return true;
};

export {
  addQa,
  upsertQa,
  getAllQa,
  getQa,
  updateQa,
  deleteQa,
  deleteDocuments,
};
