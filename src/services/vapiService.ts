export const vapiService = {
  uploadFile: async (file: File) => {
    try {
      // Check if the Vapi API key is set
      if (!process.env.NEXT_PRIVATE_VAPI_KEY) {
        throw new Error("La clave API de Vapi no está configurada");
      }

      // Prepare the form data with the file
      const formData = new FormData();
      formData.append("file", file);

      // Make the POST request to upload the file
      const response = await fetch("https://api.vapi.ai/file", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
          Accept: "application/json",
        },
        body: formData,
      });

      // Check if the response is not OK
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Error al subir archivo: ${response.status} - ${errorData}`
        );
      }

      // Return the response as JSON
      return await response.json();
    } catch (error) {
      console.error("Error en uploadFile:", error);
      throw error;
    }
  },

  deleteFile: async (fileId: string) => {
    try {
      // Make the DELETE request to remove the file
      const response = await fetch(`https://api.vapi.ai/file/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PRIVATE_VAPI_KEY}`,
        },
      });

      // Return the response as JSON
      return await response.json();
    } catch (error) {
      console.error("Error en deleteFile:", error);
      throw error;
    }
  },
};
