"use server";

import { flowiseService } from "@/services/flowiseService";
import { vapiService } from "@/services/vapiService";

import { createClient } from "@/lib/supabase/client";
import { deleteDocumentStorageById, getDocumentCounts } from "./documents";

const supabase = createClient();

const addQa = async (
  account_id: string,
  document_storage_id: string,
  qaData: { question: string; answer: string },
  namefile: string,
  idFileVapi: string
) => {
  const supabase = createClient();

  const { data, error } = await supabase.from("qa_docs").insert([
    {
      account_id,
      document_storage_id,
      question: qaData.question,
      answer: qaData.answer,
      namefile,
      vapiFileId: idFileVapi,
    },
  ]);

  if (error) {
    console.log("Error al agregar la pregunta y respuesta:", error);
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
  id: string,
  vapiFileId: string
) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("qa_docs")
    .update({
      question,
      answer,
      vapiFileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("account_id", account_id);

  if (error) {
    console.log("Error al actualizar la pregunta y respuesta:", error);
    return {
      message: error.message,
    };
  }

  return data;
};

const getAllQa = async (document_storage_id: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("qa_docs")
    .select("*")
    .eq("document_storage_id", document_storage_id);

  if (error) {
    console.log(error);
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

async function deleteQa(
  documentStorageId: string,
  id_vapi_doc: string,
  id: string,
  documentStorageNamespace: string
) {
  try {
    const supabase = createClient();

    // Verificar si es el último documento
    const documents = await getDocumentCounts(documentStorageId);

    if (documents.length === 1) {
      // Si falla deleteVectorStore, continuamos con el proceso
      try {
        await flowiseService.deleteLoader(documentStorageId, id);
        await flowiseService.insertVectorStore({
          storeId: documentStorageId,
          docId: id,
          embeddingConfig: {
            modelName: "text-embedding-3-small",
            stripNewLines: "",
            batchSize: "",
            timeout: "",
            basepath: "",
            dimensions: "",
            credential: process.env.NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE,
          },
          embeddingName: "openAIEmbeddings",
          vectorStoreConfig: {
            document: "",
            embeddings: "",
            recordManager: "",
            pineconeIndex: "intelliaa",
            pineconeNamespace: documentStorageNamespace,
            fileUpload: "",
            pineconeTextKey: "",
            pineconeMetadataFilter: "",
            topK: "10",
            searchType: "similarity",
            fetchK: "",
            lambda: "",
            credential: process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE,
          },
          vectorStoreName: "pinecone",
          recordManagerConfig: {
            host: "aws-0-us-east-1.pooler.supabase.com",
            database: "postgres",
            port: "6543",
            additionalConfig: "",
            tableName: "",
            namespace: documentStorageNamespace,
            cleanup: "full",
            sourceIdKey: "source",
            credential: process.env.NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE,
          },
          recordManagerName: "postgresRecordManager",
        });
        await vapiService.deleteFile(id_vapi_doc);
      } catch (error) {
        console.log("Error al eliminar vector store:", error);
        throw new Error("Error al eliminar vector store");
      }
      await deleteDocumentStorageById(documentStorageId);
    }
    // Eliminar el loader de Flowise
    await flowiseService.deleteLoader(documentStorageId, id);
    await flowiseService.insertVectorStore({
      storeId: documentStorageId,
      docId: null,
      embeddingConfig: {
        modelName: "text-embedding-3-small",
        stripNewLines: "",
        batchSize: "",
        timeout: "",
        basepath: "",
        dimensions: "",
        credential: process.env.NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE,
      },
      embeddingName: "openAIEmbeddings",
      vectorStoreConfig: {
        document: "",
        embeddings: "",
        recordManager: "",
        pineconeIndex: "intelliaa",
        pineconeNamespace: documentStorageNamespace,
        fileUpload: "",
        pineconeTextKey: "",
        pineconeMetadataFilter: "",
        topK: "10",
        searchType: "similarity",
        fetchK: "",
        lambda: "",
        credential: process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE,
      },
      vectorStoreName: "pinecone",
      recordManagerConfig: {
        host: "aws-0-us-east-1.pooler.supabase.com",
        database: "postgres",
        port: "6543",
        additionalConfig: "",
        tableName: "",
        namespace: documentStorageNamespace,
        cleanup: "full",
        sourceIdKey: "source",
        credential: process.env.NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE,
      },
      recordManagerName: "postgresRecordManager",
    });
    // Eliminar archivo de Vapi
    await vapiService.deleteFile(id_vapi_doc);
    // Eliminar registro de Supabase
    const { error: supabaseError } = await supabase
      .from("qa_docs")
      .delete()
      .eq("id", id);

    if (supabaseError) {
      throw new Error(
        `Error al eliminar de Supabase: ${supabaseError.message}`
      );
    }
    return {
      status: "success",
      message: "Documento eliminado correctamente",
    };
  } catch (error) {
    console.error("Error en deleteQa:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar la pregunta y respuesta",
    };
  }
}

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

const uploadTxt = async (
  account_id: string,
  documentStorageId: string,
  question: string,
  answer: string,
  formData: FormData,
  documentStorageNamespace: string
) => {
  try {
    const file = formData.get("file") as File;

    if (file.size === 0) {
      return { status: "error", message: "Empty file" };
    }
    const base64File = Buffer.from(await file.arrayBuffer()).toString("base64");
    // Procesar archivo con Flowise
    let processFile;
    try {
      processFile = await flowiseService.processFile(documentStorageId, {
        docId: null,
        loader: {
          name: "textFile",
          config: {
            textSplitter: "",
            metadata: "",
            omitMetadataKeys: "",
            txtFile: `data:text/plain;base64,${base64File},filename:${file.name}`,
          },
        },
        splitter: {
          name: "characterTextSplitter",
          config: {
            chunkSize: 1000,
            chunkOverlap: 200,
            separator: "",
          },
        },
        embedding: {
          name: "openAIEmbeddings",
          config: {
            modelName: "text-embedding-3-small",
            stripNewLines: "",
            batchSize: "",
            timeout: "",
            basepath: "",
            dimensions: "",
            credential: process.env.NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE,
          },
        },
        vectorStore: {
          name: "pinecone",
          config: {
            document: "",
            embeddings: "",
            recordManager: "",
            pineconeIndex: "intelliaa",
            pineconeNamespace: documentStorageNamespace,
            fileUpload: "",
            pineconeTextKey: "",
            pineconeMetadataFilter: "",
            topK: "10",
            searchType: "similarity",
            fetchK: "",
            lambda: "",
            credential: process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE,
          },
        },
        recordManager: {
          name: "postgresRecordManager",
          config: {
            host: "aws-0-us-east-1.pooler.supabase.com",
            database: "postgres",
            port: "6543",
            additionalConfig: "",
            tableName: "",
            namespace: documentStorageNamespace,
            cleanup: "full",
            sourceIdKey: "source",
            credential: process.env.NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE,
          },
        },
      });

      console.log("processFile", processFile);
    } catch (error) {
      console.error("Error al procesar el archivo con Flowise:", error);
      throw new Error("Error al procesar el archivo con Flowise");
    }
    await flowiseService.insertVectorStore({
      storeId: documentStorageId,
      docId: null,
      embeddingConfig: {
        modelName: "text-embedding-3-small",
        stripNewLines: "",
        batchSize: "",
        timeout: "",
        basepath: "",
        dimensions: "",
        credential: process.env.NEXT_PUBLIC_OPENAI_API_KEY_FLOWISE,
      },
      embeddingName: "openAIEmbeddings",
      vectorStoreConfig: {
        document: "",
        embeddings: "",
        recordManager: "",
        pineconeIndex: "intelliaa",
        pineconeNamespace: documentStorageNamespace,
        fileUpload: "",
        pineconeTextKey: "",
        pineconeMetadataFilter: "",
        topK: "10",
        searchType: "similarity",
        fetchK: "",
        lambda: "",
        credential: process.env.NEXT_PUBLIC_PINECONE_API_KEY_FLOWISE,
      },
      vectorStoreName: "pinecone",
      recordManagerConfig: {
        host: "aws-0-us-east-1.pooler.supabase.com",
        database: "postgres",
        port: "6543",
        additionalConfig: "",
        tableName: "",
        namespace: documentStorageNamespace,
        cleanup: "full",
        sourceIdKey: "source",
        credential: process.env.NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE,
      },
      recordManagerName: "postgresRecordManager",
    });
    // Subir a Vapi
    let vapiResult;
    try {
      vapiResult = await vapiService.uploadFile(file);
    } catch (error) {
      console.error("Error al subir archivo a Vapi:", error);
      throw new Error("Error al subir archivo a Vapi");
    }
    const { data: qaDocsSupabase, error: errorQaDocsSupabase } = await supabase
      .from("qa_docs")
      .insert([
        {
          id: processFile.docId,
          account_id: account_id,
          question: question,
          answer: answer,
          document_storage_id: documentStorageId,
          namefile: file.name,
          vapiFileId: vapiResult.id,
        },
      ])
      .select();

    if (errorQaDocsSupabase) {
      console.error("Error al guardar en base de datos:", errorQaDocsSupabase);
      throw new Error("Error al guardar en base de datos");
    }

    return {
      status: "success",
      vapiFileId: vapiResult.id,
      qaDocId: qaDocsSupabase[0].id,
    };
  } catch (error) {
    console.error("Error en el proceso de carga:", error);
    return {
      status: "error",
      message: (error as Error).message || "Error al subir el archivo",
    };
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
  uploadTxt,
};
