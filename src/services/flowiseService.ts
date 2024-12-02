// Tipos de datos
interface FlowiseProcessConfig {
  docId: string | null;
  loader: Loader;
  splitter: Splitter;
  embedding: Embedding;
  vectorStore: VectorStore;
  recordManager: RecordManager;
}

interface Loader {
  name: string;
  config: any;
}

interface Splitter {
  name: string;
  config: any;
}

interface Embedding {
  name: string;
  config: any;
}

interface VectorStore {
  name: string;
  config: any;
}

interface RecordManager {
  name: string;
  config: any;
}

interface FlowiseVectorStoreConfig {
  storeId: string;
  embeddingName: string;
  embeddingConfig: any;
  vectorStoreName: string;
  vectorStoreConfig: any;
  recordManagerName: string;
  recordManagerConfig: any;
}

export const flowiseService = {
  // Crear documento
  createDocumentStore: async (name: string, description: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/store`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      }
    );
    return await response.json();
  },

  // Procesar archivo
  processFile: async (storeId: string, config: FlowiseProcessConfig) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/upsert/${storeId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      }
    );
    return await response.json();
  },

  // Guardar en vector store
  saveVectorStore: async (config: FlowiseVectorStoreConfig) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/vectorstore/save`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      }
    );
    return await response.json();
  },

  // Insertar en vector store
  insertVectorStore: async (data: any) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/vectorstore/insert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(data),
      }
    );

    return await response.json();
  },
  // New en vector store
  newVectorStore: async (config: FlowiseVectorStoreConfig) => {
    console.log(config);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/vectorstore/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      }
    );
    return await response.json();
  },

  // Delete document store
  deleteDocumentStore: async (storeId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_FLOWISE}document-store/store/${storeId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        // Si la respuesta no es exitosa, lanza un error con el status y el mensaje
        const errorData = await response.json();
        throw new Error(`Error ${response.status}: ${errorData.message}`);
      }

      return {
        status: "success",
      };
    } catch (error) {
      console.error("Error al eliminar el vector store:", error);
      throw error; // Re-lanza el error después de registrarlo
    }
  },

  deleteVectorStore: async (storeId: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/vectorstore/${storeId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(response);
    return {
      status: "success",
    };
  },

  refreshDocumentStore: async (storeId: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FLOWISE}document-store/refresh/${storeId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    console.log(response);
    return await response.json();
  },

  // Delete vector store
  deleteLoader: async (storeId: string, loaderId: string) => {
    try {
      // Primera petición: Eliminar el loader
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_FLOWISE}document-store/loader/${storeId}/${loaderId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(response);

      const responseText = await response.text();
      let loaderDeleted;

      try {
        loaderDeleted = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(
          `Error al eliminar loader: ${responseText.substring(0, 100)}`
        );
      }

      // Esperamos un momento antes de hacer el reproceso
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Segunda petición: Reprocesar el store
      const reprocess = await fetch(
        `${process.env.NEXT_PUBLIC_FLOWISE}document-store/refresh/${storeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_FLOWISE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const reprocessText = await reprocess.text();

      console.log(reprocessText);

      let reprocessResponse;
      try {
        reprocessResponse = JSON.parse(reprocessText);
      } catch (parseError) {
        reprocessResponse = null;
      }

      return {
        status: "success",
        loaderDeleted,
        reprocessResponse,
      };
    } catch (error) {
      console.error("Error en deleteLoader:", error);

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new Error(
          "Error de conexión con el servidor. Verifica que el servidor esté funcionando."
        );
      }

      throw error;
    }
  },
};
