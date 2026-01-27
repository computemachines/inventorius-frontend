import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadEmptyProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Message shown when search returns no results.
 * Only renders when empty and not loading.
 */
export function TypeaheadEmpty({
  children = "No results found",
  className = "",
}: TypeaheadEmptyProps) {
  const typeahead = useTypeaheadContext();

  if (!typeahead.isOpen || !typeahead.isEmpty || typeahead.isLoading) {
    return null;
  }

  return <li className={`${styles.empty} ${className}`}>{children}</li>;
}
