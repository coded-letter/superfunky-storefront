export type PaymentGatewayNode = {
  id: string;
  title: string;
  description?: string | null;
};

export type CryptoAsset = {
  code: string;
  label: string;
  network: string;
  wallet: string;
  fiatRate: number | null;
  qrUrl?: string | null;
};

export type PaymentGatewayCacheSeed = {
  gateways: PaymentGatewayNode[];
  blikEnabled: boolean;
  cryptoAssets: CryptoAsset[];
};

export type RestoredPaymentGatewayCache = {
  seed: PaymentGatewayCacheSeed;
  cachedAt: number;
};

const PAYMENT_GATEWAY_MAX_STALE_MS = 24 * 60 * 60 * 1_000;

function hasOnlyKeys(value: object, allowedKeys: string[]) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPaymentGatewayNode(value: unknown): value is PaymentGatewayNode {
  if (!value || typeof value !== "object") return false;
  const gateway = value as Partial<PaymentGatewayNode>;
  return hasOnlyKeys(value, ["id", "title", "description"])
    && typeof gateway.id === "string"
    && Boolean(gateway.id.trim())
    && typeof gateway.title === "string"
    && (gateway.description === undefined || gateway.description === null || typeof gateway.description === "string");
}

function isCryptoAsset(value: unknown): value is CryptoAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<CryptoAsset>;
  return hasOnlyKeys(value, ["code", "label", "network", "wallet", "fiatRate", "qrUrl"])
    && typeof asset.code === "string"
    && typeof asset.label === "string"
    && typeof asset.network === "string"
    && typeof asset.wallet === "string"
    && (asset.fiatRate === null || (typeof asset.fiatRate === "number" && Number.isFinite(asset.fiatRate)))
    && (asset.qrUrl === undefined || asset.qrUrl === null || typeof asset.qrUrl === "string");
}

export function parsePaymentGatewayCacheSeed(value: unknown): PaymentGatewayCacheSeed | null {
  if (!value || typeof value !== "object") return null;
  const seed = value as Partial<PaymentGatewayCacheSeed>;
  if (!Array.isArray(seed.gateways) || !seed.gateways.every(isPaymentGatewayNode)) return null;
  const blikEnabled = typeof seed.blikEnabled === "boolean" ? seed.blikEnabled : false;
  if (!Array.isArray(seed.cryptoAssets) || !seed.cryptoAssets.every(isCryptoAsset)) return null;
  return { gateways: seed.gateways, blikEnabled, cryptoAssets: seed.cryptoAssets };
}

export function isPaymentGatewayCacheTimestampUsable(cachedAt: number, now = Date.now()) {
  return Number.isFinite(cachedAt)
    && cachedAt > 0
    && cachedAt <= now + 60_000
    && now - cachedAt <= PAYMENT_GATEWAY_MAX_STALE_MS;
}

export function restorePaymentGatewayCache(
  serialized: string | null,
  now = Date.now(),
): RestoredPaymentGatewayCache | null {
  if (!serialized) return null;
  const parsed = JSON.parse(serialized) as Partial<PaymentGatewayCacheSeed & { cachedAt: number }> | null;
  const seed = parsePaymentGatewayCacheSeed(parsed);
  const cachedAt = typeof parsed?.cachedAt === "number" ? parsed.cachedAt : 0;
  if (!seed || !isPaymentGatewayCacheTimestampUsable(cachedAt, now)) return null;
  return { seed, cachedAt };
}
