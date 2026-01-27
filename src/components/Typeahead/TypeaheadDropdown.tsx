import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadDropdownProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Dropdown container for typeahead suggestions.
 * Only renders when the typeahead is open.
 */
export function TypeaheadDropdown({
  children,
  className = "",
}: TypeaheadDropdownProps) {
  const typeahead = useTypeaheadContext();
  const listProps = typeahead.getListProps();

  if (!typeahead.isOpen) {
    return null;
  }

  return (
    <ul {...listProps} className={`${styles.dropdown} ${className}`}>
      {children}
    </ul>
  );
}
