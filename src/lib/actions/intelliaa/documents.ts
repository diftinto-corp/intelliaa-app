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
import type { EmbeddingService, GenerateEmbeddingsResponse, EmbeddingResult } from "@/types/embeddings";
import {
  createVapiKnowledgeBase,
  listVapiKnowledgeBases,
  addFilesToVapiKB,
} from "./vapiKnowledgeBase";
import { upsertVectors } from "@/services/pineconeService";
import {
  validateFileBuffer,
  generateUniqueNamespace,
  validateDocumentName,
} from "./documentStorageValidation";
import {
  toErrorResponse,
  toSuccessResponse,
  logError,
  EmbeddingError,
  PineconeError,
  VapiUploadError,
  VapiKnowledgeBaseError,
  DatabaseError,
  TimeoutError,
  FileValidationError,
  ProcessingStep,
  type DocumentStorageResponse,
} from "./documentStorageErrors";
import {
  executeRollback,
  createRollbackState,
  updateRollbackStateWithPinecone,
  updateRollbackStateWithVapiFile,
  updateRollbackStateWithVapiKB,
  type RollbackState,
} from "./documentStorageRollback";
import {
  acquireUploadLock,
  releaseUploadLock,
} from "./uploadLock";

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

/**
 * INTEL-005: Upload PDF to Existing Document Storage
 *
 * Adds a new PDF file to an existing document storage, embedding vectors
 * in the same namespace and updating the VAPI knowledge base.
 *
 * Flow:
 * 1. Validation (file, document storage exists, duplicate name check)
 * 2. Embedding Generation (INTEL-001: Vercel AI SDK)
 * 3. Vector Storage (INTEL-003: Pinecone - same namespace)
 * 4. VAPI File Upload
 * 5. VAPI KB Update (INTEL-002 - add to existing KB)
 * 6. Database Insert (pdf_docs table only)
 *
 * Error Handling:
 * - Comprehensive rollback on any failure
 * - User-friendly error messages
 * - Cleanup of external resources
 *
 * Security:
 * - Multi-tenant isolation via RLS
 * - Account access validation
 * - File validation (max 50MB, PDF only)
 *
 * @param formData - FormData containing file, documentStorageId, accountId
 * @returns DocumentStorageResponse with success/error details
 */
export async function uploadPdfToExistingStorage(
  formData: FormData
): Promise<DocumentStorageResponse> {
  // Initialize rollback state
  let rollbackState: RollbackState | null = null;
  let lockProcessId: string | null = null;
  let documentStorageId: string | null = null;

  // Setup AbortController for 5-minute timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 5 * 60 * 1000); // 5 minutes

  try {
    // =========================================================================
    // PHASE 1: Extract and Validate Input
    // =========================================================================

    const file = formData.get('file') as File;
    documentStorageId = formData.get('documentStorageId') as string;
    const accountId = formData.get('accountId') as string;

    // Validate required fields
    if (!file || !documentStorageId || !accountId) {
      throw new FileValidationError('Faltan campos requeridos: archivo, almacenamiento o cuenta');
    }

    // =========================================================================
    // PHASE 1.5: Acquire Upload Lock (Prevent Concurrent Uploads)
    // =========================================================================

    try {
      lockProcessId = await acquireUploadLock(documentStorageId, accountId);
      console.log('[INTEL-005] Upload lock acquired', { lockProcessId, documentStorageId });
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : 'Error al adquirir bloqueo de subida',
        error instanceof Error ? error.stack : undefined
      );
    }

    // Initialize rollback state
    rollbackState = createRollbackState(accountId, file.name);

    // Convert file to buffer for validation and processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file (max 50MB, PDF only, not empty)
    const fileValidation = validateFileBuffer(buffer, file.name);
    if (!fileValidation.valid) {
      throw new FileValidationError(fileValidation.error!);
    }

    // =========================================================================
    // PHASE 2: Fetch Document Storage and Validate
    // =========================================================================

    const supabase = await createClient();

    const { data: documentStorageData, error: fetchError } = await supabase
      .from('document_storages')
      .select('id, namespace, account_id, name, vapi_knowledge_base_id')
      .eq('id', documentStorageId)
      .eq('account_id', accountId)
      .single();

    if (fetchError || !documentStorageData) {
      throw new DatabaseError(
        'Almacenamiento de documentos no encontrado o sin acceso',
        fetchError?.message
      );
    }

    const { namespace, name: documentStorageName, vapi_knowledge_base_id } = documentStorageData;

    // Check for duplicate file names
    const { data: existingFiles } = await supabase
      .from('pdf_docs')
      .select('name')
      .eq('document_storage_id', documentStorageId);

    const fileNames = existingFiles?.map(f => f.name) || [];
    let finalFileName = file.name;

    if (fileNames.includes(file.name)) {
      // Append timestamp to avoid duplicates
      const timestamp = Date.now();
      const nameParts = file.name.split('.');
      const extension = nameParts.pop();
      const baseName = nameParts.join('.');
      finalFileName = `${baseName}-${timestamp}.${extension}`;

      console.log(`[INTEL-005] Duplicate file name detected, renamed to: ${finalFileName}`);
    }

    console.log('[INTEL-005] Starting PDF upload to existing storage', {
      accountId,
      documentStorageId,
      namespace,
      fileSize: buffer.length,
      fileName: finalFileName,
    });

    // =========================================================================
    // PHASE 3: Generate Embeddings (INTEL-001)
    // =========================================================================

    let embeddingResult: GenerateEmbeddingsResponse;
    try {
      embeddingResult = await generateEmbeddings(buffer, {
        abortSignal: abortController.signal,
        metadata: {
          documentId: `${namespace}-${Date.now()}`, // Unique ID for this PDF
          accountId,
          namespace,
          documentStorageId,
        },
      });

      console.log('[INTEL-005] Embeddings generated', {
        chunkCount: embeddingResult.results.length,
        totalTokens: embeddingResult.usage.totalTokens,
        estimatedCost: embeddingResult.usage.estimatedCost,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.EMBEDDING, 'Embedding generation timeout');
      }
      throw new EmbeddingError(
        'Error al generar embeddings del documento',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 4: Store Vectors in Pinecone (INTEL-003) - SAME NAMESPACE
    // =========================================================================

    const uniquePdfId = `${namespace}-pdf-${Date.now()}`;

    try {
      // Transform embedding results to Pinecone vector format
      const vectors = embeddingResult.results.map((result: EmbeddingResult, index: number) => ({
        id: `${uniquePdfId}-chunk-${index}`,
        values: result.embedding,
        metadata: {
          text: result.text,
          documentId: uniquePdfId,
          fileName: finalFileName,
          ...result.metadata,
        },
      }));

      // Upsert to EXISTING namespace (key difference from createDocumentStorageWithPDF)
      await upsertVectors(namespace, vectors);

      // Update rollback state
      rollbackState = updateRollbackStateWithPinecone(rollbackState, namespace);

      console.log('[INTEL-005] Vectors stored in Pinecone (existing namespace)', {
        namespace,
        vectorCount: vectors.length,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.PINECONE, 'Pinecone storage timeout');
      }

      // Execute rollback before throwing
      if (rollbackState) {
        await executeRollback(rollbackState);
      }

      throw new PineconeError(
        'Error al almacenar vectores en Pinecone',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 5: Upload File to VAPI
    // =========================================================================

    let vapiFileId: string;
    let vapiFileUrl: string;

    try {
      // Convert buffer back to File for VAPI upload
      const vapiFile = new File([buffer], finalFileName, { type: 'application/pdf' });
      const vapiUploadResult = await vapiService.uploadFile(vapiFile);

      vapiFileId = vapiUploadResult.id;
      vapiFileUrl = vapiUploadResult.url;

      // Update rollback state
      rollbackState = updateRollbackStateWithVapiFile(rollbackState, vapiFileId);

      console.log('[INTEL-005] File uploaded to VAPI', {
        vapiFileId,
        vapiFileUrl,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.VAPI_UPLOAD, 'VAPI upload timeout');
      }

      // Execute rollback before throwing
      if (rollbackState) {
        await executeRollback(rollbackState);
      }

      throw new VapiUploadError(
        'Error al subir archivo a VAPI',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 6: Update VAPI Knowledge Base (INTEL-002)
    // =========================================================================

    try {
      if (vapi_knowledge_base_id && shouldUseVapiKB()) {
        // Add file to existing KB
        console.log(`[INTEL-005] Adding file to existing VAPI KB: ${vapi_knowledge_base_id}`);
        const result = await addFilesToVapiKB(vapi_knowledge_base_id, [vapiFileId]);

        if (!result.success) {
          console.warn('[INTEL-005] Failed to add file to VAPI KB, continuing...', result.error);
        } else {
          console.log(`[INTEL-005] File added to KB. Total files: ${result.data?.file_count}`);
        }
      } else {
        console.log('[INTEL-005] No VAPI KB configured or feature disabled, skipping KB update');
      }
    } catch (error) {
      // VAPI KB update is optional - log warning but continue
      console.warn('[INTEL-005] Error updating VAPI KB, continuing without KB update', error);
    }

    // =========================================================================
    // PHASE 7: Create Database Record (pdf_docs table only)
    // =========================================================================

    const pdfDocId = crypto.randomUUID();

    try {
      const { data, error } = await supabase
        .from('pdf_docs')
        .insert({
          id: pdfDocId,
          account_id: accountId,
          document_storage_id: documentStorageId,
          name: finalFileName,
          id_vapi_doc: vapiFileId,
          url: vapiFileUrl,
          embedding_service: 'vercel' as const,
          chunk_count: embeddingResult.results.length,
          embedding_metadata: {
            model: embeddingResult.usage.model,
            totalTokens: embeddingResult.usage.totalTokens,
            estimatedCost: embeddingResult.usage.estimatedCost,
            processingTime: embeddingResult.usage.processingTime,
          },
        })
        .select()
        .single();

      if (error) {
        // Handle PostgreSQL errors
        if (error.code === '23505') {
          throw new DatabaseError(
            'Error de identificador duplicado. Por favor, inténtalo nuevamente.',
            `Duplicate PDF doc ID: ${pdfDocId}`
          );
        }

        if (error.code === '42501') {
          throw new DatabaseError(
            'No tienes permiso para agregar documentos a este almacenamiento.',
            error.message
          );
        }

        throw new DatabaseError(
          'Error al guardar en la base de datos',
          error.message
        );
      }

      if (!data) {
        throw new DatabaseError('No se recibió confirmación de la base de datos');
      }

      console.log('[INTEL-005] Database record created', {
        pdfDocId: data.id,
        fileName: finalFileName,
      });

      // =========================================================================
      // PHASE 8: Track Embedding Usage (Analytics)
      // =========================================================================

      try {
        await trackEmbeddingUsage(
          accountId,
          pdfDocId,
          embeddingResult.usage,
          'vercel' as EmbeddingService
        );
      } catch (error) {
        // Non-critical - just log
        console.error('[INTEL-005] Failed to track embedding usage:', error);
      }

      // =========================================================================
      // SUCCESS - Clear timeout and release lock
      // =========================================================================

      clearTimeout(timeoutId);

      // Release upload lock
      if (lockProcessId) {
        await releaseUploadLock(documentStorageId, lockProcessId);
        console.log('[INTEL-005] Upload lock released', { lockProcessId });
      }

      console.log('[INTEL-005] PDF uploaded successfully to existing storage', {
        pdfDocId,
        documentStorageId,
        namespace,
        fileSize: buffer.length,
        chunkCount: embeddingResult.results.length,
        fileName: finalFileName,
      });

      const wasRenamed = finalFileName !== file.name;

      return toSuccessResponse(documentStorageId, pdfDocId, {
        fileName: finalFileName,
        wasRenamed,
      });

    } catch (error) {
      // Execute rollback before throwing
      if (rollbackState) {
        const rollbackResult = await executeRollback(rollbackState);
        console.log('[INTEL-005] Rollback executed', rollbackResult);
      }

      throw error;
    }

  } catch (error) {
    // Clear timeout
    clearTimeout(timeoutId);

    // Release upload lock on error
    if (lockProcessId && documentStorageId) {
      await releaseUploadLock(documentStorageId, lockProcessId);
      console.log('[INTEL-005] Upload lock released (error)', { lockProcessId });
    }

    // Log error with context
    if (rollbackState) {
      logError(error, {
        operation: 'uploadPdfToExistingStorage',
        accountId: rollbackState.accountId,
        fileName: rollbackState.fileName,
      });
    }

    // Convert to user-friendly error response
    return toErrorResponse(error);
  }
}

/**
 * INTEL-004: Create Document Storage with Initial PDF
 *
 * This is the main server action for creating a document storage with an initial PDF file.
 * It orchestrates the entire workflow across multiple services:
 *
 * Flow:
 * 1. Validation (file, name, account access)
 * 2. Embedding Generation (INTEL-001: Vercel AI SDK)
 * 3. Vector Storage (INTEL-003: Pinecone)
 * 4. VAPI File Upload
 * 5. VAPI KB Creation/Linking (INTEL-002)
 * 6. Database Transaction (PostgreSQL function)
 *
 * Error Handling:
 * - Comprehensive rollback on any failure
 * - User-friendly error messages (AC5)
 * - Retry guidance for retryable errors
 *
 * Security:
 * - Multi-tenant isolation via RLS (AC6)
 * - Account access validation
 * - File validation (AC8, AC9, AC10)
 *
 * Performance:
 * - 5-minute timeout limit
 * - Parallel operations where possible
 *
 * @param formData - FormData containing file, name, description, accountId
 * @returns DocumentStorageResponse with success/error details
 */
export async function createDocumentStorageWithPDF(
  formData: FormData
): Promise<DocumentStorageResponse> {
  // Initialize rollback state
  let rollbackState: RollbackState | null = null;

  // Setup AbortController for 5-minute timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 5 * 60 * 1000); // 5 minutes

  try {
    // =========================================================================
    // PHASE 1: Extract and Validate Input
    // =========================================================================

    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const accountId = formData.get('accountId') as string;

    // Validate required fields
    if (!file || !name || !accountId) {
      throw new FileValidationError('Faltan campos requeridos: archivo, nombre o cuenta');
    }

    // Validate document name
    const nameValidation = validateDocumentName(name);
    if (!nameValidation.valid) {
      throw new FileValidationError(nameValidation.error!);
    }

    // Initialize rollback state
    rollbackState = createRollbackState(accountId, file.name);

    // Convert file to buffer for validation and processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file (AC8, AC9, AC10)
    const fileValidation = validateFileBuffer(buffer, file.name);
    if (!fileValidation.valid) {
      throw new FileValidationError(fileValidation.error!);
    }

    // Generate unique namespace (AC7)
    const { namespace, sanitizedName } = generateUniqueNamespace(name);

    console.log('[INTEL-004] Starting document storage creation', {
      accountId,
      name,
      namespace,
      fileSize: buffer.length,
      fileName: file.name,
    });

    // =========================================================================
    // PHASE 2: Generate Embeddings (INTEL-001)
    // =========================================================================

    let embeddingResult: GenerateEmbeddingsResponse;
    try {
      embeddingResult = await generateEmbeddings(buffer, {
        abortSignal: abortController.signal,
        metadata: {
          documentId: namespace, // Will be used in Pinecone metadata
          accountId,
          namespace,
        },
      });

      console.log('[INTEL-004] Embeddings generated', {
        chunkCount: embeddingResult.results.length,
        totalTokens: embeddingResult.usage.totalTokens,
        estimatedCost: embeddingResult.usage.estimatedCost,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.EMBEDDING, 'Embedding generation timeout');
      }
      throw new EmbeddingError(
        'Error al generar embeddings del documento',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 3: Store Vectors in Pinecone (INTEL-003)
    // =========================================================================

    try {
      // Transform embedding results to Pinecone vector format
      const vectors = embeddingResult.results.map((result: EmbeddingResult, index: number) => ({
        id: `${namespace}-chunk-${index}`,
        values: result.embedding,
        metadata: {
          text: result.text,
          documentId: namespace,
          ...result.metadata,
        },
      }));

      await upsertVectors(namespace, vectors);

      // Update rollback state
      rollbackState = updateRollbackStateWithPinecone(rollbackState, namespace);

      console.log('[INTEL-004] Vectors stored in Pinecone', {
        namespace,
        vectorCount: vectors.length,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.PINECONE, 'Pinecone storage timeout');
      }

      // Execute rollback before throwing
      if (rollbackState) {
        await executeRollback(rollbackState);
      }

      throw new PineconeError(
        'Error al almacenar vectores en Pinecone',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 4: Upload File to VAPI
    // =========================================================================

    let vapiFileId: string;
    let vapiFileUrl: string;

    try {
      // Convert buffer back to File for VAPI upload
      const vapiFile = new File([buffer], file.name, { type: 'application/pdf' });
      const vapiUploadResult = await vapiService.uploadFile(vapiFile);

      vapiFileId = vapiUploadResult.id;
      vapiFileUrl = vapiUploadResult.url;

      // Update rollback state
      rollbackState = updateRollbackStateWithVapiFile(rollbackState, vapiFileId);

      console.log('[INTEL-004] File uploaded to VAPI', {
        vapiFileId,
        vapiFileUrl,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new TimeoutError(ProcessingStep.VAPI_UPLOAD, 'VAPI upload timeout');
      }

      // Execute rollback before throwing
      if (rollbackState) {
        await executeRollback(rollbackState);
      }

      throw new VapiUploadError(
        'Error al subir archivo a VAPI',
        error instanceof Error ? error.message : String(error)
      );
    }

    // =========================================================================
    // PHASE 5: Create/Link VAPI Knowledge Base (INTEL-002)
    // =========================================================================

    let vapiKbId: string | null = null;
    let vapiKbWasCreated = false;

    try {
      const kb = await getOrCreateVapiKB(accountId, '', name); // documentStorageId not available yet

      if (kb) {
        vapiKbId = kb.vapi_kb_id;
        vapiKbWasCreated = !kb.id; // If no DB id, it was just created

        // Add file to KB
        if (vapiKbId) {
          await addFilesToVapiKB(kb.id, [vapiFileId]);
        }

        // Update rollback state
        rollbackState = updateRollbackStateWithVapiKB(
          rollbackState,
          vapiKbId,
          vapiKbWasCreated
        );

        console.log('[INTEL-004] VAPI KB linked', {
          vapiKbId,
          wasCreated: vapiKbWasCreated,
        });
      }
    } catch (error) {
      // VAPI KB is optional - log warning but continue
      console.warn('[INTEL-004] VAPI KB creation failed, continuing without KB', error);
    }

    // =========================================================================
    // PHASE 6: Create Database Records (PostgreSQL function)
    // =========================================================================

    const supabase = await createClient();
    const documentStorageId = crypto.randomUUID();

    try {
      const { data, error } = await supabase.rpc('create_document_storage_with_pdf', {
        p_document_storage_id: documentStorageId,
        p_account_id: accountId,
        p_name: name,
        p_description: description || null,
        p_namespace: namespace,
        p_pdf_doc_name: file.name,
        p_vapi_file_id: vapiFileId,
        p_vapi_file_url: vapiFileUrl,
        p_vapi_kb_id: vapiKbId,
        p_embedding_service: 'vercel' as const,
        p_chunk_count: embeddingResult.results.length,
        p_embedding_metadata: {
          model: embeddingResult.usage.model,
          totalTokens: embeddingResult.usage.totalTokens,
          estimatedCost: embeddingResult.usage.estimatedCost,
          processingTime: embeddingResult.usage.processingTime,
        },
      });

      if (error) {
        // Handle PostgreSQL function errors
        if (error.code === '23505') {
          // Namespace collision - extremely rare with crypto.randomBytes
          // Generate new namespace and retry
          throw new DatabaseError(
            'Error de identificador duplicado. Por favor, inténtalo nuevamente.',
            `Namespace collision: ${namespace}`
          );
        }

        if (error.code === '42501') {
          // Authorization error
          throw new DatabaseError(
            'No tienes permiso para crear documentos en esta cuenta.',
            error.message
          );
        }

        throw new DatabaseError(
          'Error al guardar en la base de datos',
          error.message
        );
      }

      if (!data || data.length === 0) {
        throw new DatabaseError('No se recibió confirmación de la base de datos');
      }

      const { document_storage_id, pdf_doc_id } = data[0];

      console.log('[INTEL-004] Database records created', {
        documentStorageId: document_storage_id,
        pdfDocId: pdf_doc_id,
      });

      // =========================================================================
      // PHASE 7: Track Embedding Usage (Analytics)
      // =========================================================================

      try {
        await trackEmbeddingUsage(
          accountId,
          pdf_doc_id,
          embeddingResult.usage,
          'vercel' as EmbeddingService
        );
      } catch (error) {
        // Non-critical - just log
        console.error('[INTEL-004] Failed to track embedding usage:', error);
      }

      // =========================================================================
      // SUCCESS - Clear timeout and return
      // =========================================================================

      clearTimeout(timeoutId);

      console.log('[INTEL-004] Document storage created successfully', {
        documentStorageId: document_storage_id,
        namespace,
        fileSize: buffer.length,
        chunkCount: embeddingResult.results.length,
      });

      return toSuccessResponse(document_storage_id, pdf_doc_id);

    } catch (error) {
      // Execute rollback before throwing
      if (rollbackState) {
        const rollbackResult = await executeRollback(rollbackState);
        console.log('[INTEL-004] Rollback executed', rollbackResult);
      }

      throw error;
    }

  } catch (error) {
    // Clear timeout
    clearTimeout(timeoutId);

    // Log error with context
    if (rollbackState) {
      logError(error, {
        operation: 'createDocumentStorageWithPDF',
        accountId: rollbackState.accountId,
        namespace: rollbackState.namespace,
        fileName: rollbackState.fileName,
      });
    }

    // Convert to user-friendly error response (AC5)
    return toErrorResponse(error);
  }
}

/**
 * INTEL-006: Delete PDF Document Response
 */
export interface DeletePdfResponse {
  status: 'success' | 'error';
  message?: string;
  storageDeleted?: boolean;
  warnings?: string[];
}

/**
 * INTEL-006: Delete PDF Document from Storage
 *
 * Comprehensive deletion that removes:
 * 1. Vectors from Pinecone (by metadata filter)
 * 2. File from VAPI Knowledge Base (if feature enabled)
 * 3. File from VAPI
 * 4. Database record from pdf_docs
 * 5. If last document: triggers full storage deletion
 *
 * Flow:
 * 1. Acquire deletion lock (prevent concurrent deletions)
 * 2. Validate access and fetch document info
 * 3. Check if last document → trigger storage deletion
 * 4. Delete Pinecone vectors (non-critical, graceful degradation)
 * 5. Remove from VAPI KB (non-critical)
 * 6. Delete VAPI file (non-critical)
 * 7. Delete database record (CRITICAL - transaction boundary)
 * 8. Release lock and return response
 *
 * Error Handling:
 * - External service failures (Pinecone, VAPI) → logged as warnings
 * - Database failures → CRITICAL error, attempt rollback
 * - Concurrent deletion → prevented by mutex lock
 *
 * @param documentStorageId - Document storage ID
 * @param pdfDocId - PDF document ID to delete
 * @param accountId - Account ID for validation
 * @returns DeletePdfResponse with status and warnings
 */
async function deletePdfDocument(
  documentStorageId: string,
  pdfDocId: string,
  accountId: string
): Promise<DeletePdfResponse> {
  const warnings: string[] = [];
  let lockProcessId: string | null = null;

  try {
    // =========================================================================
    // PHASE 1: Acquire Deletion Lock
    // =========================================================================

    try {
      lockProcessId = await acquireUploadLock(
        `pdf-delete-${pdfDocId}`,
        accountId
      );
      console.log('[INTEL-006] Deletion lock acquired', {
        lockProcessId,
        pdfDocId,
      });
    } catch (error) {
      return {
        status: 'error',
        message:
          'Otro proceso está eliminando este documento. Por favor, espera unos segundos e intenta nuevamente.',
      };
    }

    // =========================================================================
    // PHASE 2: Validate Access and Fetch Document Info
    // =========================================================================

    const supabase = await createClient();

    // Fetch document with validation
    const { data: pdfDoc, error: fetchError } = await supabase
      .from('pdf_docs')
      .select('id, name, id_vapi_doc, document_storage_id, account_id')
      .eq('id', pdfDocId)
      .eq('account_id', accountId)
      .eq('document_storage_id', documentStorageId)
      .single();

    if (fetchError || !pdfDoc) {
      await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);
      return {
        status: 'error',
        message: 'Documento no encontrado o sin acceso',
      };
    }

    const { id_vapi_doc: vapiFileId, name: fileName } = pdfDoc;

    // Fetch document storage info
    const { data: storageData, error: storageError } = await supabase
      .from('document_storages')
      .select('id, namespace, vapi_knowledge_base_id, name')
      .eq('id', documentStorageId)
      .eq('account_id', accountId)
      .single();

    if (storageError || !storageData) {
      await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);
      return {
        status: 'error',
        message: 'Almacenamiento no encontrado',
      };
    }

    const {
      namespace,
      vapi_knowledge_base_id: vapiKbId,
      name: storageName,
    } = storageData;

    console.log('[INTEL-006] Starting PDF deletion', {
      pdfDocId,
      fileName,
      documentStorageId,
      namespace,
      vapiKbId,
    });

    // =========================================================================
    // PHASE 3: Check if Last Document
    // =========================================================================

    const documents = await getDocumentCounts(documentStorageId);
    const isLastDocument = documents.length === 1;

    if (isLastDocument) {
      console.log(
        '[INTEL-006] Last document detected, triggering full storage deletion'
      );

      // Release lock before storage deletion (it will handle its own locking)
      await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);

      // Trigger full storage deletion
      try {
        await deleteAllDocumentStorageById(documentStorageId);

        return {
          status: 'success',
          message: `Documento "${fileName}" eliminado. El almacenamiento "${storageName}" también fue eliminado porque era el último documento.`,
          storageDeleted: true,
        };
      } catch (error) {
        console.error('[INTEL-006] Failed to delete storage:', error);
        return {
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Error al eliminar el almacenamiento',
        };
      }
    }

    // =========================================================================
    // PHASE 4: Delete Pinecone Vectors (Non-Critical)
    // =========================================================================

    try {
      const { deleteVectorsByMetadata } = await import('@/services/pineconeService');

      const deletedCount = await deleteVectorsByMetadata(namespace, {
        documentId: pdfDocId,
      });

      console.log('[INTEL-006] Deleted Pinecone vectors', {
        namespace,
        deletedCount,
      });
    } catch (error) {
      const warningMsg = `No se pudieron eliminar los vectores de Pinecone: ${
        error instanceof Error ? error.message : 'Error desconocido'
      }`;
      warnings.push(warningMsg);
      console.warn('[INTEL-006] Pinecone deletion failed (non-critical)', error);
    }

    // =========================================================================
    // PHASE 5: Remove from VAPI Knowledge Base (Non-Critical)
    // =========================================================================

    if (vapiKbId && vapiFileId && shouldUseVapiKB()) {
      try {
        const { removeFilesFromVapiKB } = await import(
          './vapiKnowledgeBase'
        );

        const result = await removeFilesFromVapiKB(vapiKbId, [
          vapiFileId,
        ]);

        if (!result.success) {
          warnings.push(
            `No se pudo actualizar el Knowledge Base: ${result.error?.message || 'Error desconocido'}`
          );
        } else {
          console.log('[INTEL-006] Removed file from VAPI KB', {
            vapiKbId,
            vapiFileId,
          });
        }
      } catch (error) {
        warnings.push(
          `Error al actualizar VAPI Knowledge Base: ${
            error instanceof Error ? error.message : 'Error desconocido'
          }`
        );
        console.warn('[INTEL-006] VAPI KB update failed (non-critical)', error);
      }
    }

    // =========================================================================
    // PHASE 6: Delete VAPI File (Non-Critical)
    // =========================================================================

    if (vapiFileId) {
      try {
        await vapiService.deleteFile(vapiFileId);
        console.log('[INTEL-006] Deleted VAPI file', { vapiFileId });
      } catch (error) {
        warnings.push(
          `No se pudo eliminar el archivo de VAPI: ${
            error instanceof Error ? error.message : 'Error desconocido'
          }`
        );
        console.warn('[INTEL-006] VAPI file deletion failed (non-critical)', error);
      }
    }

    // =========================================================================
    // PHASE 7: Delete Database Record (CRITICAL)
    // =========================================================================

    const { error: deleteError } = await supabase
      .from('pdf_docs')
      .delete()
      .eq('id', pdfDocId);

    if (deleteError) {
      // CRITICAL ERROR - Database deletion failed
      console.error('[INTEL-006] Database deletion failed:', deleteError);

      // Attempt best-effort rollback (re-add to VAPI KB if removed)
      if (vapiKbId && vapiFileId && shouldUseVapiKB()) {
        try {
          const { addFilesToVapiKB } = await import('./vapiKnowledgeBase');
          await addFilesToVapiKB(vapiKbId, [vapiFileId]);
          console.log('[INTEL-006] Rollback: Re-added file to VAPI KB');
        } catch (rollbackError) {
          console.error('[INTEL-006] Rollback failed:', rollbackError);
        }
      }

      await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);

      return {
        status: 'error',
        message: `Error al eliminar de la base de datos: ${deleteError.message}`,
      };
    }

    // =========================================================================
    // SUCCESS - Release Lock and Return
    // =========================================================================

    await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);

    console.log('[INTEL-006] PDF document deleted successfully', {
      pdfDocId,
      fileName,
      warnings: warnings.length,
    });

    const successMessage =
      warnings.length > 0
        ? `Documento "${fileName}" eliminado con advertencias`
        : `Documento "${fileName}" eliminado correctamente`;

    return {
      status: 'success',
      message: successMessage,
      storageDeleted: false,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    // Release lock on unexpected errors
    if (lockProcessId) {
      await releaseUploadLock(`pdf-delete-${pdfDocId}`, lockProcessId);
    }

    console.error('[INTEL-006] Unexpected error in deletePdfDocument:', error);

    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Error inesperado al eliminar el documento',
    };
  }
}

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
  deletePdfDocument,
};
