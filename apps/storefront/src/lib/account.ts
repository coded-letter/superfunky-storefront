import { authStore } from "./auth";
import { graphqlRequest } from "./graphqlClient";

export type AccountAddressType = "billing" | "shipping";

export type AccountAddress = {
  type: AccountAddressType;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
};

export type AccountOrder = {
  databaseId: number;
  number: string;
  date: string;
  status: string;
  statusText: string;
  total: string;
  currency: string;
  items: { name: string; variation: string; quantity: number; total: string }[];
};

export type StorefrontAccount = {
  databaseId: number;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "member" | "creator" | "collaborator";
  profilePublic: boolean;
  layoutPreferences: string | null;
  billingAddress: AccountAddress;
  shippingAddress: AccountAddress;
  orders: AccountOrder[];
};

const ACCOUNT_FIELDS = /* GraphQL */ `
  databaseId
  displayName
  firstName
  lastName
  email
  role
  profilePublic
  layoutPreferences
  billingAddress {
    type firstName lastName company address1 address2 city state postcode country phone email
  }
  shippingAddress {
    type firstName lastName company address1 address2 city state postcode country phone email
  }
  orders {
    databaseId number date status statusText total currency
    items { name variation quantity total }
  }
`;

export async function getStorefrontAccount(): Promise<StorefrontAccount | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  const { data, errors } = await graphqlRequest<{ funkycommerceAccount: StorefrontAccount | null }>(
    `query StorefrontAccount { funkycommerceAccount { ${ACCOUNT_FIELDS} } }`,
    undefined,
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return data?.funkycommerceAccount || null;
}

export async function getOrderById(orderId: number): Promise<AccountOrder | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  const { data, errors } = await graphqlRequest<{ funkycommerceOrder: AccountOrder | null }>(
    `query StorefrontOrder($id: Int!) {
      funkycommerceOrder(id: $id) {
        databaseId number date status statusText total currency
        items { name variation quantity total }
      }
    }`,
    { id: orderId },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return data?.funkycommerceOrder || null;
}

export async function updateStorefrontAddress(type: AccountAddressType, address: Omit<AccountAddress, "type">): Promise<AccountAddress> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in before updating an address");
  const { data, errors } = await graphqlRequest<{ updateFunkycommerceAddress: { address: AccountAddress } | null }>(
    `mutation UpdateStorefrontAddress($type: String!, $address: FunkycommerceAccountAddressInput!) {
      updateFunkycommerceAddress(input: { type: $type, address: $address }) {
        address { type firstName lastName company address1 address2 city state postcode country phone email }
      }
    }`,
    { type, address },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.updateFunkycommerceAddress?.address) throw new Error("The address update returned no data");
  return data.updateFunkycommerceAddress.address;
}

export async function saveLayoutPreferences(preferences: Record<string, unknown>): Promise<void> {
  const token = authStore.load()?.authToken;
  if (!token) return;
  await graphqlRequest(
    `mutation SaveLayoutPreferences($preferences: String!) {
      updateFunkycommerceLayoutPreferences(input: { preferences: $preferences }) { saved }
    }`,
    { preferences: JSON.stringify(preferences) },
    token,
  );
}

export async function loadLayoutPreferences(): Promise<Record<string, unknown> | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  const { data } = await graphqlRequest<{ funkycommerceAccount: { layoutPreferences: string | null } | null }>(
    `query StorefrontLayoutPreferences { funkycommerceAccount { layoutPreferences } }`,
    undefined,
    token,
  );
  const raw = data?.funkycommerceAccount?.layoutPreferences;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
