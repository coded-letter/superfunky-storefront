
import { graphqlRequest } from "@funky/sdk";

export type ElevenLabsPayload = {
    post: {
        elwrReaderHtml: string | null;
    } | null;
    elwrHeadlessAssets: {
        css: string | null;
        scriptUrl: string | null;
    } | null;
};

const QUERY = `
  query ElevenLabsReader($id: ID!) {
    post(id: $id, idType: DATABASE_ID) {
      elwrReaderHtml
    }
    elwrHeadlessAssets {
      css
      scriptUrl
    }
  }
`;

export async function fetchElevenLabsReader(
    postId: number
): Promise<ElevenLabsPayload> {
    const { data, errors } =
        await graphqlRequest<ElevenLabsPayload>(
            QUERY,
            { id: String(postId) }
        );

    if (errors?.length) {
        throw new Error(
            errors.map(({ message }) => message).join("; ")
        );
    }

    if (!data) {
        throw new Error("ElevenLabs GraphQL returned no data");
    }

    return data;
}
