import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";
import fetch from "cross-fetch";
import { createHttpLink } from "@apollo/client/link/http";
import { setContext } from "@apollo/client/link/context";
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";

const activeWsService = async (
  assistant_id: string,
  namespace: string,
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

const createWsChatbotService = async (
  assistant_id: string,
  nameAssistant: string,
  key_word_ws: string
) => {
  const urlBackend = process.env.NEXT_PUBLIC_FLOWISE_CHATWS_PREDICTION;
  const projectId = process.env.NEXT_PUBLIC_RAILWAY_PROYECTID;
  const repoChatbot = process.env.NEXT_PUBLIC_RAILWAY_REPOSITORY_CHAT;
  const eventLab_Token = process.env.NEXT_PUBLIC_ELEVENLABS_TOKEN;
  const openAI_Token = process.env.NEXT_PUBLIC_OPENAI_KEY;
  const railwayToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;
  const railwayUri = process.env.NEXT_PUBLIC_RAILWAY_URI;
  const SERVER_TOKEN = process.env.NEXT_PUBLIC_FLOWISE_KEY;
  const branch = process.env.NEXT_RAILWAY_BRANCH;
  const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase_anon_key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (process.env.NODE_ENV !== "production") {
    loadDevMessages();
    loadErrorMessages();
  }

  const httpLink = createHttpLink({
    uri: railwayUri,
    fetch: fetch,
  });

  const authLink = setContext(() => {
    return {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${railwayToken}`,
      },
    };
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: authLink.concat(httpLink),
  });

  // Railway Domain Chatbot Util function
  const railwayDomainChatbotUtil = async (serviceId: string) => {
    try {
      const newDomain = client.mutate({
        mutation: gql`
          mutation {
            serviceDomainCreate (
              input: { environmentId: "708c1410-af63-470b-96c8-6f03682691ab", serviceId: "${serviceId}" }
            ) {
              domain,
              environmentId,
              id,
              serviceId,
            }
          }
        `,
      });

      const dataDomain = await newDomain.then((result) => {
        return result;
      });

      return { dataDomain };
    } catch (e: any) {
      throw new Error(e.message);
    }
  };

  try {
    const service = await client.mutate({
      mutation: gql`
        mutation createService($input: ServiceCreateInput!) {
          serviceCreate(input: $input) {
            id
            deployments {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      variables: {
        input: {
          branch,
          name: nameAssistant,
          projectId,
          source: { repo: repoChatbot },
          variables: {
            ASSISTANT_ID: assistant_id,
            SERVER_TOKEN,
            URI_SERVER: urlBackend,
            ELEVENT_TOKEN: eventLab_Token,
            OPENAI_API_KEY: openAI_Token,
            KEY_WORD_WS: key_word_ws,
            SUPABASE_URL: supabase_url,
            SUPABASE_KEY: supabase_anon_key,
          },
        },
      },
    });

    const serviceId = service.data.serviceCreate.id;
    if (!serviceId) {
      console.log("Service ID is null or undefined.");
      throw new Error("Service ID is null or undefined.");
    }

    const dataWithDomain = await railwayDomainChatbotUtil(serviceId);

    const url = `https://${dataWithDomain.dataDomain.data.serviceDomainCreate.domain}`;

    return {
      serviceId,
      domain: dataWithDomain.dataDomain.data.serviceDomainCreate.domain,
      url,
      assistant_id,
      railwayToken,
      railwayUri,
    };
  } catch (e: any) {
    console.log(e.message);
    return {
      error: e.message,
    };
  }
};

export { activeWsService, createWsChatbotService };
