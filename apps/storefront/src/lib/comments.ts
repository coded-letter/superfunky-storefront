import type { ProductReview } from "../pages/shared";
import { graphqlRequest } from "@funky/sdk";
import { authStore } from "./auth";

export type CreateReviewInput = {
  commentOn: number;
  author: string;
  authorEmail: string;
  content: string;
  rating?: number;
  parent?: number;
};

type CreateReviewResult = {
  createReview: {
    comment: {
      id: string;
      databaseId: number;
      content: string | null;
      date: string | null;
      parentId: string | null;
      parentDatabaseId: number | null;
      status: string | null;
      rating: number | null;
      author: { node: { name: string | null } } | null;
    } | null;
  } | null;
};

const CREATE_REVIEW_MUTATION = /* GraphQL */ `
  mutation StorefrontCreateReview($input: CreateReviewInput!) {
    createReview(input: $input) {
      comment {
        id
        databaseId
        content(format: RENDERED)
        date
        parentId
        parentDatabaseId
        status
        rating
        author {
          node {
            name
          }
        }
      }
    }
  }
`;

export async function createReview(input: CreateReviewInput): Promise<ProductReview> {
  const { data, errors } = await graphqlRequest<CreateReviewResult>(CREATE_REVIEW_MUTATION, { input }, authStore.load()?.authToken);

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }

  const comment = data?.createReview?.comment;
  if (!comment) {
    return {
      id: `pending-${Date.now()}`,
      databaseId: 0,
      author: input.author,
      content: input.content,
      date: new Date().toISOString(),
      parentId: null,
      parentDatabaseId: input.parent || 0,
      rating: input.rating,
      isPending: true,
    };
  }

  return {
    id: comment.id,
    databaseId: comment.databaseId,
    author: comment.author?.node.name?.trim() || input.author,
    content: htmlToText(comment.content || input.content),
    date: comment.date || new Date().toISOString(),
    parentId: comment.parentId,
    parentDatabaseId: comment.parentDatabaseId,
    rating: normalizeRating(comment.rating),
    isPending: comment.status !== "APPROVE",
  };
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}

function normalizeRating(rating: number | null): number | undefined {
  return rating && rating >= 1 && rating <= 5 ? rating : undefined;
}
