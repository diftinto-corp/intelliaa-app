const activeWsService = async (
  assistant_id: string,
  nameChatbot: string,
  userID: string,
  namespace: string,
  userName: string,
  key_word_ws: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BUILDSHIP_URL_DEPLOY_RAILWAY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistant_id: assistant_id,
          nameAssistant: namespace,
          key_word_ws: key_word_ws,
        }),
      }
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Error al activar el servicio de WhatsApp");
    }

    return result;
  } catch (error) {
    console.error((error as Error).message);
  }
};

export { activeWsService };
