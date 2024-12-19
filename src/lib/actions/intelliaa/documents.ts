"use server";

import { createClient } from "@/lib/supabase/server";
import {
  GetAssistant,
  getAssistantByDocumentStorage,
  getDsAssistant,
} from "./assistants";
import { flowiseService } from "@/services/flowiseService";
import { vapiService } from "@/services/vapiService";
import { getAllQa } from "./qa";

const supabase = createClient();

async function createDocumentStorage(account_id: string, formData: FormData) {
  const name = formData.get("name");
  const description = formData.get("description");
  const file = formData.get("file") as File;

  if (file.size === 0) {
    return { status: "error", message: "Empty file" };
  }

  const base64File = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    // Crear documento en Flowise

    const documentStorageNamespace = `${name
      ?.toString()
      .replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 8)}`;

    const documentStorage = await flowiseService.createDocumentStore(
      name as string,
      description as string
    );

    // Procesar archivo
    let processFile;
    try {
      processFile = await flowiseService.processFile(documentStorage.id, {
        docId: null,
        loader: {
          name: "pdfFile",
          config: {
            loaderId: "pdfFile",
            legacyBuild: "",
            textSplitter: "",
            metadata: "",
            omitMetadataKeys: "",
            pdfFile: `data:application/pdf;base64,${base64File},filename:${file.name}`,
            usage: "perPage",
          },
        },
        splitter: {
          name: "recursiveCharacterTextSplitter",
          config: {
            chunkSize: 1500,
            chunkOverlap: 750,
            separator: "",
          },
        },
        embedding: {
          name: "openAIEmbeddings",
          config: {
            modelName: "text-embedding-ada-002",
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
            pineconeIndex: process.env.NEXT_PUBLIC_PINECONE_INDEX,
            pineconeNamespace: documentStorageNamespace,
            fileUpload: "",
            pineconeTextKey: "",
            pineconeMetadataFilter: "",
            topK: "1",
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

    //Subir a Vapi
    const vapiResult = await vapiService.uploadFile(file);

    // console.log("processFile.file.id", processFile.file.id);

    const {
      data: createDocumentStorageSupabase,
      error: errorCreateDocumentStorageSupabase,
    } = await supabase
      .from("document_storages")
      .insert([
        {
          id: documentStorage.id,
          account_id,
          name: documentStorage.name,
          description: documentStorage.description,
          namespace: documentStorageNamespace,
        },
      ])
      .select();

    if (errorCreateDocumentStorageSupabase) {
      console.error(errorCreateDocumentStorageSupabase);
    }

    const { data: pdfDocsSupabase, error: errorPdfDocsSupabase } =
      await supabase
        .from("pdf_docs")
        .insert([
          {
            id: processFile.docId,
            account_id: createDocumentStorageSupabase?.[0]?.account_id,
            document_storage_id: documentStorage.id,
            name: file.name,
            id_vapi_doc: vapiResult.id,
            url: vapiResult.url,
          },
        ])
        .select();

    if (errorPdfDocsSupabase) {
      console.error(errorPdfDocsSupabase);
    }

    return {
      createDocumentStorageSupabase,
      pdfDocsSupabase,
    };
  } catch (error) {
    console.error(error);
    throw new Error("Error al crear el documento");
  }
}

async function getAllDocumentStorage(account_id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("document_storages")
    .select("*")
    .eq("account_id", account_id);

  if (error) {
    console.log(error);
  }

  return data;
}

async function getDocumentStorageById(documentStorageId: string) {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("document_storages")
      .select("*")
      .eq("id", documentStorageId);
    return data;
  } catch (error) {
    console.error(error);
  }
}

async function deleteDocumentStorageById(documentStorageId: string) {
  const supabase = createClient();

  try {
    const deleteDocumentStorageFlowise =
      await flowiseService.deleteDocumentStore(documentStorageId);

    if (deleteDocumentStorageFlowise.status !== "success") {
      throw new Error("Failed to delete document storage in Flowise");
    }

    const { error: errorDeleteDocumentsPDF } = await supabase
      .from("pdf_docs")
      .delete()
      .eq("document_storage_id", documentStorageId);

    if (errorDeleteDocumentsPDF) {
      throw new Error(
        `Error deleting PDF documents: ${errorDeleteDocumentsPDF.message}`
      );
    }

    const { error: errorDeleteDocumentQA } = await supabase
      .from("qa_docs")
      .delete()
      .eq("document_storage_id", documentStorageId);

    if (errorDeleteDocumentQA) {
      throw new Error(
        `Error deleting QA documents: ${errorDeleteDocumentQA.message}`
      );
    }

    const { error: errorDeleteDocumentStorage } = await supabase
      .from("document_storages")
      .delete()
      .eq("id", documentStorageId);

    if (errorDeleteDocumentStorage) {
      throw new Error(
        `Error deleting document storage: ${errorDeleteDocumentStorage.message}`
      );
    }
  } catch (error) {
    console.error("Error in deleteDocumentStorageById:", error);
    throw error; // Re-throw the error after logging it
  }
}
async function deleteAllDocumentStorageById(documentStorageId: string) {
  const supabase = createClient();

  try {
    const { data: assistants, error } = await supabase
      .from("document_storage-assistants")
      .select("*")
      .eq("document_storage", documentStorageId);

    if (error) {
      console.error("Error getting assistants:", error);
      throw new Error("Error getting assistants");
    }

    if (assistants.length > 0) {
      throw new Error(
        "No se puede eliminar el document storage, ya que esta asignado a un asistente"
      );
    }

    const allFiles = await getDocumentCounts(documentStorageId);

    for (const file of allFiles) {
      const vapiResult = await vapiService.deleteFile(
        file.id_vapi_doc || file.vapiFileId
      );
      if (vapiResult.id === null) {
        throw new Error("Failed to delete file in Vapi");
      }
    }

    const deleteDocumentStorageFlowise =
      await flowiseService.deleteDocumentStore(documentStorageId);

    if (deleteDocumentStorageFlowise.status !== "success") {
      throw new Error("Failed to delete document storage in Flowise");
    }

    const { error: errorDeleteDocumentsPDF } = await supabase
      .from("pdf_docs")
      .delete()
      .eq("document_storage_id", documentStorageId);

    if (errorDeleteDocumentsPDF) {
      throw new Error(
        `Error deleting PDF documents: ${errorDeleteDocumentsPDF.message}`
      );
    }

    const { error: errorDeleteDocumentQA } = await supabase
      .from("qa_docs")
      .delete()
      .eq("document_storage_id", documentStorageId);

    if (errorDeleteDocumentQA) {
      throw new Error(
        `Error deleting QA documents: ${errorDeleteDocumentQA.message}`
      );
    }

    const { error: errorDeleteDocumentStorage } = await supabase
      .from("document_storages")
      .delete()
      .eq("id", documentStorageId);

    if (errorDeleteDocumentStorage) {
      throw new Error(
        `Error deleting document storage: ${errorDeleteDocumentStorage.message}`
      );
    }
  } catch (error) {
    console.error("Error in deleteDocumentStorageById:", error);
    throw error; // Re-throw the error after logging it
  }
}

async function getDocumentCounts(documentStorageId: string) {
  const supabase = createClient();

  // Obtener registros de la tabla `pdf_docs`
  const { data: pdfDocs, error: pdfError } = await supabase
    .from("pdf_docs")
    .select("*")
    .eq("document_storage_id", documentStorageId);

  if (pdfError) {
    console.error("Error al obtener registros en pdf_docs:", pdfError);
    throw new Error(
      `Error al obtener registros en pdf_docs: ${pdfError.message}`
    );
  }

  // Obtener registros de la tabla `qa_docs`
  const { data: qaDocs, error: qaError } = await supabase
    .from("qa_docs")
    .select("*")
    .eq("document_storage_id", documentStorageId);

  if (qaError) {
    console.error("Error al obtener registros en qa_docs:", qaError);
    throw new Error(
      `Error al obtener registros en qa_docs: ${qaError.message}`
    );
  }

  // Retornar un array con los elementos de pdf_docs y qa_docs
  return [...pdfDocs, ...qaDocs];
}

async function getDocumentsPDFforDocumentStorage(
  account_id: string,
  id: string
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pdf_docs")
    .select("*")
    .eq("document_storage_id", id)
    .eq("account_id", account_id);
  if (error) {
    console.log(error);
  }

  return data;
}

async function uploadPdf(
  documentStorageId: string,
  account_id: string,
  formData: FormData,
  documentStorageNamespace: string
) {
  try {
    // Validar archivo
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      throw new Error("Archivo vacío o inválido");
    }

    // Convertir archivo a base64
    let base64File;
    try {
      base64File = Buffer.from(await file.arrayBuffer()).toString("base64");
    } catch (error) {
      throw new Error("Error al procesar el archivo");
    }

    // Procesar archivo con Flowise
    //TODO: Revisar si se puede usar el mismo loaderId
    let processFile;
    try {
      processFile = await flowiseService.processFile(documentStorageId, {
        docId: null,
        loader: {
          name: "pdfFile",
          config: {
            loaderId: "pdfFile",
            legacyBuild: "",
            textSplitter: "",
            metadata: "",
            omitMetadataKeys: "",
            pdfFile: `data:application/pdf;base64,${base64File},filename:${file.name}`,
            usage: "perPage",
          },
        },
        splitter: {
          name: "recursiveCharacterTextSplitter",
          config: {
            chunkSize: 1500,
            chunkOverlap: 750,
            separator: "",
          },
        },
        embedding: {
          name: "openAIEmbeddings",
          config: {
            modelName: "text-embedding-ada-002",
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
            pineconeIndex: process.env.NEXT_PUBLIC_PINECONE_INDEX,
            pineconeNamespace: documentStorageNamespace,
            fileUpload: "",
            pineconeTextKey: "",
            pineconeMetadataFilter: "",
            topK: "1",
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

    // Subir a Vapi
    let vapiResult;
    try {
      vapiResult = await vapiService.uploadFile(file);
    } catch (error) {
      console.error("Error al subir archivo a Vapi:", error);
      throw new Error("Error al subir archivo a Vapi");
    }

    // Guardar en Supabase
    console.log("processFile", processFile);

    const { data: pdfDocsSupabase, error: errorPdfDocsSupabase } =
      await supabase
        .from("pdf_docs")
        .insert([
          {
            id: processFile.docId,
            account_id,
            document_storage_id: documentStorageId,
            name: file.name,
            id_vapi_doc: vapiResult.id,
            url: vapiResult.url,
          },
        ])
        .select();

    if (errorPdfDocsSupabase) {
      console.error("Error al guardar en base de datos:", errorPdfDocsSupabase);
      throw new Error("Error al guardar en base de datos");
    }

    return {
      status: "success",
      data: pdfDocsSupabase,
    };
  } catch (error) {
    console.error("Error en uploadPdf:", error);
    return {
      status: "error",
      message: (error as Error).message || "Error al subir el archivo",
    };
  }
}

async function deletePdf(
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
            modelName: "text-embedding-ada-002",
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
            pineconeIndex: process.env.NEXT_PUBLIC_PINECONE_INDEX,
            pineconeNamespace: documentStorageNamespace,
            fileUpload: "",
            pineconeTextKey: "",
            pineconeMetadataFilter: "",
            topK: "1",
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
      }
      await deleteDocumentStorageById(documentStorageId);
    }

    // Eliminar el loader de Flowise
    await flowiseService.deleteLoader(documentStorageId, id);
    await flowiseService.insertVectorStore({
      storeId: documentStorageId,
      docId: null,
      embeddingConfig: {
        modelName: "text-embedding-ada-002",
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
        pineconeIndex: process.env.NEXT_PUBLIC_PINECONE_INDEX,
        pineconeNamespace: documentStorageNamespace,
        fileUpload: "",
        pineconeTextKey: "",
        pineconeMetadataFilter: "",
        topK: "1",
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
      .from("pdf_docs")
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
    console.error("Error en deletePdf:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar el PDF",
    };
  }
}

async function getDocumentssByDocumentStorageId(account_id: string) {
  try {
    const supabase = createClient();

    // Verificar que account_id no esté vacío
    if (!account_id) {
      console.error("El account_id está vacío");
      return;
    }

    const { data: storages, error } = await supabase
      .from("document_storages")
      .select(
        `
         id,
         name,
         pdf_docs(id_vapi_doc),
         qa_docs(vapiFileId)
        `
      )
      .eq("account_id", account_id);

    if (error) {
      console.error("Error en getDocumentssByDocumentStorageId:", error);
      return;
    }

    const formattedData = storages.map((storage) => ({
      document_storage_id: storage.id,
      document_storage_name: storage.name,
      document_ids: [
        ...(storage.pdf_docs?.map(
          (doc: { id_vapi_doc: string }) => doc.id_vapi_doc
        ) || []),
        ...(storage.qa_docs?.map(
          (doc: { vapiFileId: string }) => doc.vapiFileId
        ) || []),
      ],
    }));

    return formattedData;
  } catch (error) {
    console.error("Error en getPDFsByDocumentStorageId:", error);
  }
}
async function getDocumentsByDocumentStorageIdWs(account_id: string) {
  try {
    const supabase = createClient();

    if (!account_id) {
      console.error("El account_id está vacío");
      return;
    }

    const { data: storages, error } = await supabase
      .from("document_storages")
      .select("*")
      .eq("account_id", account_id);

    if (error) {
      console.error("Error en getDocumentssByDocumentStorageId:", error);
      return;
    }

    return storages;
  } catch (error) {
    console.error("Error en getPDFsByDocumentStorageId:", error);
  }
}

///Revsar///

const searchAssistantByDocument = async (
  accountId: string,
  pdf_doc_key: string,
  documents_vapi: string
) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("embedded_pdfs")
    .select("*")
    .eq("account_id", accountId)
    .eq("pdf_doc_key", pdf_doc_key);

  if (error) {
    console.error("Error fetching embedded PDFs:", error);
    return { message: error.message };
  }

  const assistantsVoiceName = await getAssistantsVoiceName(documents_vapi);
  const assistantsWsName = await getAssistantsWsName(accountId, data);

  return [...assistantsWsName, ...assistantsVoiceName];
};

const getAssistantsVoiceName = async (documents_vapi: string) => {
  const supabase = createClient();
  const assistantsVoiceName: string[] = [];

  const { data: assistantsByDocumentVapi, error } = await supabase
    .from("assistants")
    .select("name")
    .filter("documents_vapi", "cs", `{${documents_vapi}}`);

  if (error) {
    console.error("Error fetching assistants:", error);
    return [];
  }

  if (assistantsByDocumentVapi.length > 0) {
    assistantsVoiceName.push(
      ...assistantsByDocumentVapi.map((assistant) => assistant.name)
    );
  } else {
    console.log("No hay asistentes");
  }

  return assistantsVoiceName;
};

const getAssistantsWsName = async (accountId: string, data: any[]) => {
  const assistantsWsName: string[] = [];

  if (data.length > 0) {
    const assistantIds = data.map((assistant: any) => assistant.assistant_id);

    const assistantPromises = assistantIds.map(async (assistantId) => {
      const assistant = await GetAssistant(accountId, assistantId);
      if (assistant) {
        assistantsWsName.push(assistant.name);
      }
    });

    await Promise.all(assistantPromises);
  } else {
    console.log("No hay asistentes");
  }

  return assistantsWsName;
};

export {
  uploadPdf,
  searchAssistantByDocument,
  createDocumentStorage,
  getDocumentStorageById,
  getDocumentssByDocumentStorageId,
  getDocumentsByDocumentStorageIdWs,
  deleteDocumentStorageById,
  deleteAllDocumentStorageById,
  getAllDocumentStorage,
  getDocumentsPDFforDocumentStorage,
  deletePdf,
  getDocumentCounts,
};
