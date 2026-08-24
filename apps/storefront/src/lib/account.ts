import { authStore } from "./auth";
import { graphqlRequest } from "@funky/sdk";
import { loadOrderConfirmation, ORDER_CONFIRMATION_TTL_MS } from "./orderConfirmation";
import { formatStoreApiMoney } from "./storeApiMoney";
import { getOrder, type StoreApiOrder } from "./wcStoreApi";
import type { OrderDownload } from "./downloads";

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
  language: string;
  items: { name: string; variation: string; quantity: number; total: string }[];
  downloads: OrderDownload[];
  hasDownloadableItems: boolean;
  downloadPermitted: boolean;
};

export type PrivateOrderResult = {
  order: AccountOrder;
  access: "account" | "guest";
  expiresAt?: number;
};

function storeApiOrderToAccountOrder(
  order: StoreApiOrder,
  orderNumber: string,
  capturedAt: string,
): AccountOrder {
  return {
    databaseId: order.id,
    number: orderNumber,
    date: capturedAt,
    status: order.status,
    statusText: order.status,
    total: formatStoreApiMoney(order.totals.total_price, order.totals),
    currency: order.totals.currency_code,
    language: "",
    items: order.items.map((item) => ({
      name: item.name,
      variation: (item.variation || [])
        .map((attribute) => `${attribute.attribute}: ${attribute.value}`)
        .join(", "),
      quantity: item.quantity,
      total: formatStoreApiMoney(item.totals.line_total, item.totals),
    })),
    downloads: [],
    hasDownloadableItems: false,
    downloadPermitted: false,
  };
}

export async function getPrivateOrderById(orderId: number): Promise<PrivateOrderResult | null> {
  const authToken = authStore.getToken() ?? authStore.load()?.authToken;
  let accountError: unknown = null;

  if (authToken) {
    try {
      const order = await getOrderById(orderId);
      if (order) return { order, access: "account" };
    } catch (error) {
      accountError = error;
    }
  }

  const confirmation = loadOrderConfirmation(orderId);
  if (!confirmation) {
    if (accountError instanceof Error) throw accountError;
    return null;
  }

  const orderKey = confirmation.order.order_key;
  if (!orderKey) {
    throw new Error("Guest order credentials are unavailable.");
  }
  const response = await getOrder(
    orderId,
    orderKey,
    confirmation.billingEmail,
  );
  if (!response.ok) {
    throw new Error(response.error);
  }
  const capturedAt = Date.parse(confirmation.capturedAt);
  return {
    order: storeApiOrderToAccountOrder(
      response.data,
      confirmation.order.order_number || String(orderId),
      confirmation.capturedAt,
    ),
    access: "guest",
    expiresAt: capturedAt + ORDER_CONFIRMATION_TTL_MS,
  };
}

export type StorefrontAccount = {
  databaseId: number;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerificationRequired: boolean;
  emailVerified: boolean;
  role: "member" | "creator" | "collaborator";
  profilePublic: boolean;
  avatarUrl: string | null;
  avatarAttachmentId: number | null;
  billingAddress: AccountAddress;
  shippingAddress: AccountAddress;
  orders: AccountOrder[];
};

const ACCOUNT_PROFILE_FIELDS = /* GraphQL */ `
  databaseId
  displayName
  firstName
  lastName
  email
  emailVerificationRequired
  emailVerified
  role
  profilePublic
  avatarUrl
  avatarAttachmentId
  billingAddress {
    type firstName lastName company address1 address2 city state postcode country phone email
  }
  shippingAddress {
    type firstName lastName company address1 address2 city state postcode country phone email
  }
`;

const ACCOUNT_ORDER_FIELDS = /* GraphQL */ `
  orders {
    databaseId number date status statusText total currency language
    items { name variation quantity total }
    downloads { id orderId productId productName fileName url remaining expiresAt }
    hasDownloadableItems
    downloadPermitted
  }
`;

let cachedAccount: { token: string; account: StorefrontAccount | null } | null = null;
let accountRequest: { token: string; promise: Promise<StorefrontAccount | null> } | null = null;
let cachedOrders: { token: string; orders: AccountOrder[] } | null = null;
let ordersRequest: { token: string; promise: Promise<AccountOrder[]> } | null = null;

export function getCachedStorefrontAccount(): StorefrontAccount | null {
  const token = authStore.load()?.authToken;
  return token && cachedAccount?.token === token ? cachedAccount.account : null;
}

export function getCachedStorefrontAccountOrders(): AccountOrder[] | null {
  const token = authStore.load()?.authToken;
  return token && cachedOrders?.token === token ? cachedOrders.orders : null;
}

export async function getStorefrontAccount({ force = false }: { force?: boolean } = {}): Promise<StorefrontAccount | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  if (!force && cachedAccount?.token === token) return cachedAccount.account;
  if (!force && accountRequest?.token === token) return accountRequest.promise;

  const promise = graphqlRequest<{ funkycommerceAccount: Omit<StorefrontAccount, "orders"> | null }>(
    `query StorefrontAccountProfile { funkycommerceAccount { ${ACCOUNT_PROFILE_FIELDS} } }`,
    undefined,
    token,
  ).then(({ data, errors }) => {
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    const account = data?.funkycommerceAccount
      ? {
          ...data.funkycommerceAccount,
          orders: cachedOrders?.token === token ? cachedOrders.orders : [],
        }
      : null;
    cachedAccount = { token, account };
    return account;
  }).finally(() => {
    if (accountRequest?.promise === promise) accountRequest = null;
  });

  accountRequest = { token, promise };
  return promise;
}

export async function getStorefrontAccountOrders({ force = false }: { force?: boolean } = {}): Promise<AccountOrder[]> {
  const token = authStore.load()?.authToken;
  if (!token) return [];
  if (!force && cachedOrders?.token === token) return cachedOrders.orders;
  if (!force && ordersRequest?.token === token) return ordersRequest.promise;

  const promise = graphqlRequest<{ funkycommerceAccount: { orders: AccountOrder[] } | null }>(
    `query StorefrontAccountOrders { funkycommerceAccount { ${ACCOUNT_ORDER_FIELDS} } }`,
    undefined,
    token,
  ).then(({ data, errors }) => {
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
    const orders = data?.funkycommerceAccount?.orders || [];
    cachedOrders = { token, orders };
    if (cachedAccount?.token === token && cachedAccount.account) {
      cachedAccount = {
        token,
        account: { ...cachedAccount.account, orders },
      };
    }
    return orders;
  }).finally(() => {
    if (ordersRequest?.promise === promise) ordersRequest = null;
  });

  ordersRequest = { token, promise };
  return promise;
}

export async function getOrderById(orderId: number): Promise<AccountOrder | null> {
  const token = authStore.load()?.authToken;
  if (!token) return null;
  const { data, errors } = await graphqlRequest<{ funkycommerceOrder: AccountOrder | null }>(
    `query StorefrontOrder($id: Int!) {
      funkycommerceOrder(id: $id) {
        databaseId number date status statusText total currency language
        items { name variation quantity total }
        downloads { id orderId productId productName fileName url remaining expiresAt }
        hasDownloadableItems
        downloadPermitted
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

export async function resendStorefrontEmailVerification(): Promise<string> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in before requesting a confirmation email");
  const { data, errors } = await graphqlRequest<{
    resendFunkycommerceEmailVerification: { status: string } | null;
  }>(
    `mutation ResendStorefrontEmailVerification {
      resendFunkycommerceEmailVerification(input: {}) { status }
    }`,
    undefined,
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return data?.resendFunkycommerceEmailVerification?.status || "failed";
}

export async function updateStorefrontEmail(email: string): Promise<StorefrontAccount> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in before updating your email");
  const { data, errors } = await graphqlRequest<{
    updateFunkycommerceAccountEmail: { account: StorefrontAccount } | null;
  }>(
    `mutation UpdateStorefrontEmail($email: String!) {
      updateFunkycommerceAccountEmail(input: { email: $email }) {
        account { ${ACCOUNT_PROFILE_FIELDS} }
      }
    }`,
    { email },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.updateFunkycommerceAccountEmail?.account) throw new Error("The email update returned no account");
  const account = {
    ...data.updateFunkycommerceAccountEmail.account,
    orders: cachedOrders?.token === token ? cachedOrders.orders : [],
  };
  cachedAccount = { token, account };
  return account;
}

export type AccountAvatar = {
  avatarUrl: string | null;
  attachmentId: number | null;
};

export async function uploadStorefrontAvatar(imageDataUrl: string): Promise<AccountAvatar> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in before changing your avatar");
  const { data, errors } = await graphqlRequest<{
    uploadFunkycommerceAvatar: AccountAvatar | null;
  }>(
    `mutation UploadStorefrontAvatar($imageDataUrl: String!) {
      uploadFunkycommerceAvatar(input: { imageDataUrl: $imageDataUrl }) {
        avatarUrl
        attachmentId
      }
    }`,
    { imageDataUrl },
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.uploadFunkycommerceAvatar?.avatarUrl) throw new Error("The avatar upload returned no image");
  return data.uploadFunkycommerceAvatar;
}

export async function removeStorefrontAvatar(): Promise<AccountAvatar> {
  const token = authStore.load()?.authToken;
  if (!token) throw new Error("Sign in before removing your avatar");
  const { data, errors } = await graphqlRequest<{
    removeFunkycommerceAvatar: AccountAvatar | null;
  }>(
    `mutation RemoveStorefrontAvatar {
      removeFunkycommerceAvatar(input: {}) {
        avatarUrl
        attachmentId
      }
    }`,
    undefined,
    token,
  );
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.removeFunkycommerceAvatar) throw new Error("The avatar removal returned no data");
  return data.removeFunkycommerceAvatar;
}
