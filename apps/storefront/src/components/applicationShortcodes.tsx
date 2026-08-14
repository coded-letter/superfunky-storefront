import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type ApplicationShortcodeOverride = {
  names: string[];
  attributes: Record<string, string>;
  embedded: boolean;
};

const ApplicationShortcodeOverrideContext = createContext<ApplicationShortcodeOverride | null>(null);

export function ApplicationShortcodeOverrideProvider({
  names,
  attributes,
  children,
}: {
  names: string[];
  attributes: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <ApplicationShortcodeOverrideContext.Provider value={{ names, attributes, embedded: true }}>
      {children}
    </ApplicationShortcodeOverrideContext.Provider>
  );
}

export function useApplicationShortcode(
  names: string[],
  defaults: Record<string, string>,
): Record<string, string> {
  const override = useContext(ApplicationShortcodeOverrideContext);
  return override?.names.some((name) => names.includes(name))
    ? { ...defaults, ...override.attributes }
    : defaults;
}

export function useEmbeddedApplicationShortcode(): boolean {
  return useContext(ApplicationShortcodeOverrideContext)?.embedded === true;
}

export function StandaloneApplicationNotice({ shortcode }: { shortcode: string }) {
  return (
    <section role="status" className="sf-app-notice mx-auto my-12 max-w-xl rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      Add the [{shortcode}] shortcode to an ordinary CMS Page to render this module.
    </section>
  );
}

export function useConfiguredState<T>(configuredValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(configuredValue);
  useEffect(() => setValue(configuredValue), [configuredValue]);
  return [value, setValue];
}
