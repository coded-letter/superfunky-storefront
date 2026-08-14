import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { flagIconSrc, type LanguageOption } from "./options";
import { useCurrency } from "./CurrencyContext";
import { useLanguage } from "./LanguageContext";

/** Shared outside-click + Escape handling for a trigger/panel dropdown pair. */
function useDropdown<T extends HTMLElement>() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, containerRef };
}

/** Desktop triggers sit on the header's translucent surface, so an opaque white chip
 * reads fine there. Inside the mobile drawer (already a solid white/zinc-950 panel),
 * that same flat white background just blends into a plain white box — so `fullWidth`
 * usage swaps it for the same tinted "recessed control" surface as the drawer's search
 * input, keeping every drawer item background-free/tinted instead of solid white. */
function getTriggerClass(fullWidth: boolean) {
  return [
    "inline-flex h-10 items-center gap-1.5 rounded-2xl border border-zinc-200 px-3.5 text-xs font-semibold text-zinc-700 no-underline transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600 hover:shadow-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300",
    fullWidth ? "bg-zinc-100/70" : "bg-white",
  ].join(" ");
}

const panelClassBase =
  "absolute z-50 mt-2 grid gap-0.5 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900";

/** Anchored to a fixed width on the right for compact desktop triggers; stretched to
 * match the trigger's own width when used full-width (e.g. inside the mobile drawer),
 * so the panel never spills outside its column. */
function getPanelClass(fullWidth: boolean) {
  return fullWidth ? `${panelClassBase} inset-x-0 w-auto` : `${panelClassBase} right-0 w-28`;
}

const optionClass =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 dark:text-zinc-200 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";

export type LanguageSwitcherProps = {
  className?: string;
  fullWidth?: boolean;
};

export function LanguageSwitcher({ className = "", fullWidth = false }: LanguageSwitcherProps) {
  const { canSwitchLanguage, languageCode, languageOptions, setLanguageCode } = useLanguage();
  const selected = languageOptions.find(({ code }) => code === languageCode) ?? languageOptions[0];
  const { isOpen, setIsOpen, containerRef } = useDropdown<HTMLDivElement>();

  if (!canSwitchLanguage) return null;

  return (
    <div ref={containerRef} className={`sf-language-switcher relative ${fullWidth ? "flex-1" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${getTriggerClass(fullWidth)} ${fullWidth ? "w-full justify-center" : ""}`}
      >
        <img src={flagIconSrc(selected.flagCode)} alt="" className="h-3.5 w-5 rounded-[2px] object-cover" aria-hidden="true" />
        {selected.code.toUpperCase()}
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
      </button>

      {isOpen ? (
        <ul role="listbox" aria-label="Select language" className={`${getPanelClass(fullWidth)} scrollbar-thin max-h-72 overflow-y-auto`}>
          {languageOptions.map((language) => (
            <li key={language.code}>
              <button
                type="button"
                role="option"
                aria-selected={language.code === selected.code}
                title={language.label}
                aria-label={language.label}
                onClick={() => {
                  setLanguageCode(language.code);
                  setIsOpen(false);
                }}
                className={`${optionClass} ${language.code === selected.code ? "bg-zinc-100 dark:bg-zinc-800/70" : ""}`}
              >
                <img src={flagIconSrc(language.flagCode)} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" aria-hidden="true" />
                <span className="font-semibold uppercase tracking-wide">{language.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type CurrencySwitcherProps = {
  className?: string;
  fullWidth?: boolean;
};

export function CurrencySwitcher({ className = "", fullWidth = false }: CurrencySwitcherProps) {
  const { currencyCode, currencyOptions, setCurrencyCode } = useCurrency();
  const selected = currencyOptions.find(({ code }) => code === currencyCode) ?? currencyOptions[0];
  const { isOpen, setIsOpen, containerRef } = useDropdown<HTMLDivElement>();

  return (
    <div ref={containerRef} className={`sf-currency-switcher relative ${fullWidth ? "flex-1" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${getTriggerClass(fullWidth)} ${fullWidth ? "w-full justify-center" : ""}`}
      >
        {selected.icon ? <img src={selected.icon} alt="" className="h-4 w-4 object-contain" aria-hidden="true" /> : selected.symbol} {selected.code}
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
      </button>

      {isOpen ? (
        <ul role="listbox" aria-label="Select currency" className={`${getPanelClass(fullWidth)} scrollbar-thin max-h-72 overflow-y-auto`}>
          {currencyOptions.map((currency) => (
            <li key={currency.code}>
              <button
                type="button"
                role="option"
                aria-selected={currency.code === selected.code}
                title={currency.label}
                aria-label={currency.label}
                onClick={() => {
                  setCurrencyCode(currency.code);
                  setIsOpen(false);
                }}
                className={`${optionClass} ${currency.code === selected.code ? "bg-zinc-100 dark:bg-zinc-800/70" : ""}`}
              >
                <span className="w-5 shrink-0 text-center text-zinc-400" aria-hidden="true">
                  {currency.icon ? <img src={currency.icon} alt="" className="mx-auto h-4 w-4 object-contain" /> : currency.symbol}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide">{currency.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
