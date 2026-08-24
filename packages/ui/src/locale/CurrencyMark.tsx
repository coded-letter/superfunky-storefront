export type CurrencyMarkProps = {
  code: string;
  size?: number;
  className?: string;
};

export function CurrencyMark({ code, size = 16, className = "" }: CurrencyMarkProps) {
  const normalizedCode = code.toUpperCase();
  if (normalizedCode !== "BTC" && normalizedCode !== "ETH") return null;

  return (
    <span
      aria-hidden="true"
      data-currency-mark={normalizedCode}
      className={`inline-grid shrink-0 place-items-center bg-transparent font-semibold leading-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "transparent",
        fontSize: Math.round(size * 0.88),
      }}
    >
      {normalizedCode === "ETH" ? (
        <svg viewBox="0 0 256 417" width="100%" height="100%" fill="none" aria-hidden="true">
          <path fill="currentColor" d="m127.9 0-2.8 9.5v275.2l2.8 2.8 127.9-75.6L127.9 0Z" />
          <path fill="currentColor" opacity=".65" d="M127.9 0 0 211.9l127.9 75.6V0Z" />
          <path fill="currentColor" d="m127.9 311.7-1.6 2v98.1l1.6 4.7L256 236.1l-128.1 75.6Z" />
          <path fill="currentColor" opacity=".65" d="M127.9 416.5V311.7L0 236.1l127.9 180.4Z" />
        </svg>
      ) : "₿"}
    </span>
  );
}
