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
import { shouldUseVercelEmbeddings } from "@/lib/featureFlags";
import { generateEmbeddings, validatePDF } from "@/services/embeddingService";
import { trackEmbeddingUsage } from "./embeddings";
import type { EmbeddingService } from "@/types/embeddings";
import {
  createVapiKnowledgeBase,
  listVapiKnowledgeBases,
  addFilesToVapiKB,
} from "./vapiKnowledgeBase";

/**
 * Check if VAPI Knowledge Base feature is enabled
 * INTEL-002: Feature flag for gradual rollout
 */
function shouldUseVapiKB(): boolean {
  return process.env.NEXT_PUBLIC_USE_VAPI_KB === 'true';
}

/**
 * Helper: Get or create VAPI KB for a document storage
 * INTEL-002: Creates KB if doesn't exist, otherwise returns existing
 */
async function getOrCreateVapiKB(
  accountId: string,
  documentStorageId: string,
  documentStorageName: string
) {
  if (!shouldUseVapiKB()) {
    console.log('[INTEL-002] VAPI KB feature disabled, skipping KB creation');
    return null;
  }

  try {
    // Check if KB already exists for this document storage
    const existingKBs = await listVapiKnowledgeBases({
      accountId,
      status: 'active',
    });

    if (!existingKBs.success) {
      console.error('[INTEL-002] Failed to list existing KBs:', existingKBs.error);
      return null;
    }

    // Find KB by name pattern (document storage name)
    const existingKB = existingKBs.data?.find(
      kb => kb.name === `KB: ${documentStorageName}`
    );

    if (existingKB) {
      console.log(`[INTEL-002] Found existing VAPI KB: ${existingKB.id}`);
      return existingKB;
    }

    // Create new KB
    console.log(`[INTEL-002] Creating new VAPI KB for document storage: ${documentStorageName}`);
    const newKB = await createVapiKnowledgeBase({
      accountId,
      name: `KB: ${documentStorageName}`,
      description: `Knowledge base for document storage: ${documentStorageName}`,
      provider: 'google',
      fileIds: [], // Will add files after upload
    });

    if (!newKB.success) {
      console.error('[INTEL-002] Failed to create VAPI KB:', newKB.error);
      return null;
    }

    console.log(`[INTEL-002] Created VAPI KB: ${newKB.data?.id}`);
    return newKB.data;
  } catch (error) {
    console.error('[INTEL-002] Error in getOrCreateVapiKB:', error);
    return null;
  }
}

/**
 * Helper: Add VAPI file to KB after successful upload
 * INTEL-002: Links uploaded file to knowledge base
 */
async function linkFileToVapiKB(
  accountId: string,
  documentStorageId: string,
  documentStorageName: string,
  vapiFileId: string
) {
  if (!shouldUseVapiKB()) {
    return;
  }

  try {
    const kb = await getOrCreateVapiKB(accountId, documentStorageId, documentStorageName);
    if (!kb) {
      console.log('[INTEL-002] No KB available, skipping file link');
      return;
    }

    console.log(`[INTEL-002] Adding file ${vapiFileId} to KB ${kb.id}`);
    const result = await addFilesToVapiKB(kb.id, [vapiFileId]);

    if (!result.success) {
      console.error('[INTEL-002] Failed to add file to KB:', result.error);
      return;
    }

    console.log(`[INTEL-002] Successfully added file to KB. Total files: ${result.data?.file_count}`);
  } catch (error) {
    console.error('[INTEL-002] Error linking file to VAPI KB:', error);
  }
}

async function createDocumentStorage(account_id: string, formData: FormData) {
  const name = formData.get("name");
  const description = formData.get("description");
  const file = formData.get("file") as File;

  if (file.size === 0) {
    return { status: "error", message: "Empty file" };
  }

  // Check feature flag to determine which embedding service to use
  const useVercelEmbeddings = await shouldUseVercelEmbeddings(account_id);
  const embeddingService: EmbeddingService = useVercelEmbeddings ? 'vercel' : 'flowise';

  console.log(`[INTEL-001] Using ${embeddingService} embedding service for account ${account_id}`);

  const base64File = Buffer.from(await file.arrayBuffer()).toString("base64");
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const documentStorageNamespace = `${name
      ?.toString()
      .replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 8)}`;

    // Create document storage in Flowise (still needed for metadata storage)
    const documentStorage = await flowiseService.createDocumentStore(
      name as string,
      description as string
    );

    let processFile;
    let embeddingMetadata: any = null;

    // Branch: Use Vercel AI SDK or Flowise based on feature flag
    if (useVercelEmbeddings) {
      // **NEW PATH: Vercel AI SDK Embeddings (INTEL-001)**
      try {
        console.log('[INTEL-001] Validating PDF file...');
        validatePDF(fileBuffer);

        console.log('[INTEL-001] Generating embeddings with Vercel AI SDK...');
        const embeddingResult = await generateEmbeddings(fileBuffer, {
          model: 'text-embedding-ada-002',
          chunkSize: 1500,
          chunkOverlap: 750,
          metadata: {
            documentStorageId: documentStorage.id,
            namespace: documentStorageNamespace,
            accountId: account_id,
          },
        });

        console.log(`[INTEL-001] Generated ${embeddingResult.results.length} embeddings`);
        console.log(`[INTEL-001] Cost: $${embeddingResult.usage.estimatedCost.toFixed(6)}`);
        console.log(`[INTEL-001] Processing time: ${embeddingResult.usage.processingTime}ms`);

        // Track usage for monitoring and billing
        await trackEmbeddingUsage(
          account_id,
          null, // documentId will be set after insert
          embeddingResult.usage,
          'vercel'
        );

        // Store metadata for later reference
        embeddingMetadata = {
          service: 'vercel',
          model: embeddingResult.usage.model,
          chunkCount: embeddingResult.usage.chunkCount,
          totalTokens: embeddingResult.usage.totalTokens,
          estimatedCost: embeddingResult.usage.estimatedCost,
          processingTime: embeddingResult.usage.processingTime,
        };

        // Create a mock processFile object to maintain compatibility
        // TODO (INTEL-003): Store embeddings in Pinecone instead of Flowise
        processFile = {
          docId: `vercel-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'success',
          embeddings: embeddingResult.results,
        };

        console.log('[INTEL-001] Vercel embeddings generated successfully');
      } catch (error) {
        console.error('[INTEL-001] Error generating embeddings with Vercel AI SDK:', error);
        // Fallback to Flowise if Vercel fails
        console.log('[INTEL-001] Falling back to Flowise...');
        processFile = await processFileWithFlowise(
          documentStorage.id,
          base64File,
          file.name,
          documentStorageNamespace
        );
        embeddingMetadata = { service: 'flowise', fallback: true };
      }
    } else {
      // **LEGACY PATH: Flowise Embeddings**
      processFile = await processFileWithFlowise(
        documentStorage.id,
        base64File,
        file.name,
        documentStorageNamespace
      );
      embeddingMetadata = { service: 'flowise' };
    }

    // Upload to Vapi (still needed for voice assistant integration)
    const vapiResult = await vapiService.uploadFile(file);

    // INTEL-002: Link file to VAPI Knowledge Base (if feature enabled)
    await linkFileToVapiKB(
      account_id,
      documentStorage.id,
      documentStorage.name,
      vapiResult.id
    );

    // Save to Supabase
    const supabase = await createClient();
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
      throw new Error("Error creating document storage in Supabase");
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
            embedding_service: embeddingMetadata?.service || 'flowise',
            chunk_count: embeddingMetadata?.chunkCount,
            embedding_metadata: embeddingMetadata,
          },
        ])
        .select();

    if (errorPdfDocsSupabase) {
      console.error(errorPdfDocsSupabase);
      throw new Error("Error saving PDF document to Supabase");
    }

    console.log(`[INTEL-001] Document storage created successfully using ${embeddingService}`);

    return {
      createDocumentStorageSupabase,
      pdfDocsSupabase,
    };
  } catch (error) {
    console.error('[INTEL-001] Error in createDocumentStorage:', error);
    throw new Error("Error al crear el documento");
  }
}

/**
 * Helper function to process file with Flowise (legacy path)
 */
async function processFileWithFlowise(
  documentStorageId: string,
  base64File: string,
  fileName: string,
  namespace: string
) {
  return await flowiseService.processFile(documentStorageId, {
    docId: null,
    loader: {
      name: "pdfFile",
      config: {
        loaderId: "pdfFile",
        legacyBuild: "",
        textSplitter: "",
        metadata: "",
        omitMetadataKeys: "",
        pdfFile: `data:application/pdf;base64,${base64File},filename:${fileName}`,
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
        pineconeNamespace: namespace,
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
        namespace: namespace,
        cleanup: "full",
        sourceIdKey: "source",
        credential: process.env.NEXT_PUBLIC_POSTGRES_API_KEY_FLOWISE,
      },
    },
  });
}

async function getAllDocumentStorage(account_id: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();

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
  const supabase = await createClient();

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

async function getDocumentStorageByAssistantId(assistantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_storage-assistants")
    .select("*")
    .eq("assistant", assistantId);

  return data;
}

async function getDocumentCounts(documentStorageId: string) {
  const supabase = await createClient();

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
  const supabase = await createClient();
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

    // INTEL-002: Get document storage info for VAPI KB
    const documentStorageInfo = await getDocumentStorageById(documentStorageId);
    const documentStorageName = documentStorageInfo?.[0]?.name || 'Unknown';

    // Check feature flag to determine which embedding service to use
    const useVercelEmbeddings = await shouldUseVercelEmbeddings(account_id);
    const embeddingServiceType: EmbeddingService = useVercelEmbeddings ? 'vercel' : 'flowise';

    console.log(`[INTEL-001] uploadPdf: Using ${embeddingServiceType} embedding service for account ${account_id}`);

    const base64File = Buffer.from(await file.arrayBuffer()).toString("base64");
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let processFile;
    let embeddingMetadata: any = null;

    // Branch: Use Vercel AI SDK or Flowise based on feature flag
    if (useVercelEmbeddings) {
      // **NEW PATH: Vercel AI SDK Embeddings (INTEL-001)**
      try {
        console.log('[INTEL-001] Validating PDF file...');
        validatePDF(fileBuffer);

        console.log('[INTEL-001] Generating embeddings with Vercel AI SDK...');
        const embeddingResult = await generateEmbeddings(fileBuffer, {
          model: 'text-embedding-ada-002',
          chunkSize: 1500,
          chunkOverlap: 750,
          metadata: {
            documentStorageId,
            namespace: documentStorageNamespace,
            accountId: account_id,
          },
        });

        console.log(`[INTEL-001] Generated ${embeddingResult.results.length} embeddings`);
        console.log(`[INTEL-001] Cost: $${embeddingResult.usage.estimatedCost.toFixed(6)}`);
        console.log(`[INTEL-001] Processing time: ${embeddingResult.usage.processingTime}ms`);

        // Track usage for monitoring and billing
        await trackEmbeddingUsage(
          account_id,
          null, // documentId will be set after insert
          embeddingResult.usage,
          'vercel'
        );

        // Store metadata
        embeddingMetadata = {
          service: 'vercel',
          model: embeddingResult.usage.model,
          chunkCount: embeddingResult.usage.chunkCount,
          totalTokens: embeddingResult.usage.totalTokens,
          estimatedCost: embeddingResult.usage.estimatedCost,
          processingTime: embeddingResult.usage.processingTime,
        };

        // Create mock processFile object
        // TODO (INTEL-003): Store embeddings in Pinecone
        processFile = {
          docId: `vercel-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'success',
          embeddings: embeddingResult.results,
        };

        console.log('[INTEL-001] Vercel embeddings generated successfully');
      } catch (error) {
        console.error('[INTEL-001] Error generating embeddings with Vercel AI SDK:', error);
        // Fallback to Flowise if Vercel fails
        console.log('[INTEL-001] Falling back to Flowise...');
        processFile = await processFileWithFlowise(
          documentStorageId,
          base64File,
          file.name,
          documentStorageNamespace
        );
        embeddingMetadata = { service: 'flowise', fallback: true };
      }
    } else {
      // **LEGACY PATH: Flowise Embeddings**
      processFile = await processFileWithFlowise(
        documentStorageId,
        base64File,
        file.name,
        documentStorageNamespace
      );
      embeddingMetadata = { service: 'flowise' };
    }

    // Subir a Vapi
    let vapiResult;
    try {
      vapiResult = await vapiService.uploadFile(file);
    } catch (error) {
      console.error("Error al subir archivo a Vapi:", error);
      throw new Error("Error al subir archivo a Vapi");
    }

    // INTEL-002: Link file to VAPI Knowledge Base (if feature enabled)
    await linkFileToVapiKB(
      account_id,
      documentStorageId,
      documentStorageName,
      vapiResult.id
    );

    // Guardar en Supabase
    const supabase = await createClient();
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
            embedding_service: embeddingMetadata?.service || 'flowise',
            chunk_count: embeddingMetadata?.chunkCount,
            embedding_metadata: embeddingMetadata,
          },
        ])
        .select();

    if (errorPdfDocsSupabase) {
      console.error("Error al guardar en base de datos:", errorPdfDocsSupabase);
      throw new Error("Error al guardar en base de datos");
    }

    console.log(`[INTEL-001] PDF uploaded successfully using ${embeddingServiceType}`);

    return {
      status: "success",
      data: pdfDocsSupabase,
    };
  } catch (error) {
    console.error("[INTEL-001] Error en uploadPdf:", error);
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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();
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
  getDocumentStorageByAssistantId,
  getDocumentsByDocumentStorageIdWs,
  deleteDocumentStorageById,
  deleteAllDocumentStorageById,
  getAllDocumentStorage,
  getDocumentsPDFforDocumentStorage,
  deletePdf,
  getDocumentCounts,
};
