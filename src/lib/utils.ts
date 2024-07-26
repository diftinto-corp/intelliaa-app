import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { client } from "@/lib/graphqlClient";
import { gql } from "@apollo/client/core/core.cjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const railwayDomainChatbotUtil = async (serviceId: string) => {
  try {
    const newDomain = client.mutate({
      mutation: gql`
            mutation {
            serviceDomainCreate (
            input: {environmentId: "708c1410-af63-470b-96c8-6f03682691ab", serviceId:"${serviceId}"}
            ) {
                domain,
                environmentId,
                id,
                serviceId,
            }
}`,
    });

    const dataDomain = await newDomain.then((result) => {
      return result;
    });

    return {
      dataDomain,
    };
  } catch (e: any) {
    throw new Error(e.message);
  }
};
