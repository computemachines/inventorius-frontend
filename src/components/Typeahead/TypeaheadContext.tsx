import { createContext, useContext } from "react";
import { UseTypeaheadReturn } from "./useTypeahead";

/**
 * Context for sharing typeahead state between compound components.
 */
export const TypeaheadContext = createContext<UseTypeaheadReturn<unknown> | null>(
  null
);

/**
 * Hook to access typeahead context.
 * Throws if used outside of a Typeahead.Root.
 */
export function useTypeaheadContext<T = unknown>(): UseTypeaheadReturn<T> {
  const context = useContext(TypeaheadContext);
  if (!context) {
    throw new Error(
      "Typeahead compound components must be used within a Typeahead.Root"
    );
  }
  return context as UseTypeaheadReturn<T>;
}
