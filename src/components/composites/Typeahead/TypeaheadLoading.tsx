// src/components/composites/Typeahead/TypeaheadLoading.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadLoadingProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Loading indicator shown while async search is in progress.
 * Only renders when loading and dropdown is open.
 */
export function TypeaheadLoading({
  children = "Loading...",
  className = "",
}: TypeaheadLoadingProps) {
  const typeahead = useTypeaheadContext();

  if (!typeahead.isOpen || !typeahead.isLoading) {
    return null;
  }

  return <li className={`${styles.loading} ${className}`}>{children}</li>;
}
