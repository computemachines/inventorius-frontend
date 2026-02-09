// src/components/composites/Typeahead/TypeaheadItem.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadItemProps<T> {
  item: T;
  index: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Individual item in the typeahead dropdown.
 * Handles selection and keyboard navigation highlighting.
 */
export function TypeaheadItem<T>({
  item,
  index,
  children,
  className = "",
}: TypeaheadItemProps<T>) {
  const typeahead = useTypeaheadContext<T>();
  const itemProps = typeahead.getItemProps(item, index);
  const isSelected = typeahead.selectedIndex === index;

  return (
    <li
      {...itemProps}
      className={`${styles.item} ${isSelected ? styles.itemSelected : ""} ${className}`}
    >
      {children}
    </li>
  );
}
