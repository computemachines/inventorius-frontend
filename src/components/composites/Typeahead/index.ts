// src/components/composites/Typeahead/index.ts
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


// Core hook
export { useTypeahead } from "./useTypeahead";
export type {
  UseTypeaheadOptions,
  UseTypeaheadReturn,
} from "./useTypeahead";

// Context
export { TypeaheadContext, useTypeaheadContext } from "./TypeaheadContext";

// Compound components
export { TypeaheadRoot } from "./TypeaheadRoot";
export type { TypeaheadRootProps } from "./TypeaheadRoot";

export { TypeaheadInput } from "./TypeaheadInput";
export type { TypeaheadInputProps } from "./TypeaheadInput";

export { TypeaheadDropdown } from "./TypeaheadDropdown";
export type { TypeaheadDropdownProps } from "./TypeaheadDropdown";

export { TypeaheadItem } from "./TypeaheadItem";
export type { TypeaheadItemProps } from "./TypeaheadItem";

export { TypeaheadLoading } from "./TypeaheadLoading";
export type { TypeaheadLoadingProps } from "./TypeaheadLoading";

export { TypeaheadEmpty } from "./TypeaheadEmpty";
export type { TypeaheadEmptyProps } from "./TypeaheadEmpty";

export { TypeaheadCreate } from "./TypeaheadCreate";
export type { TypeaheadCreateProps } from "./TypeaheadCreate";

// Pre-built variants
export { TypeaheadField } from "./TypeaheadField";
export type { TypeaheadFieldProps } from "./TypeaheadField";

export { AsyncTypeaheadField } from "./AsyncTypeaheadField";
export type { AsyncTypeaheadFieldProps } from "./AsyncTypeaheadField";

// Styles (for custom implementations)
export { styles as typeaheadStyles } from "./typeahead.styles";

// Namespace export for compound component pattern
import { TypeaheadRoot } from "./TypeaheadRoot";
import { TypeaheadInput } from "./TypeaheadInput";
import { TypeaheadDropdown } from "./TypeaheadDropdown";
import { TypeaheadItem } from "./TypeaheadItem";
import { TypeaheadLoading } from "./TypeaheadLoading";
import { TypeaheadEmpty } from "./TypeaheadEmpty";
import { TypeaheadCreate } from "./TypeaheadCreate";

/**
 * Compound component namespace for JSX dot notation:
 *
 * ```tsx
 * <Typeahead.Root {...options}>
 *   <Typeahead.Input placeholder="Search..." clearable />
 *   <Typeahead.Dropdown>
 *     <Typeahead.Loading />
 *     {items.map((item, i) => (
 *       <Typeahead.Item key={item.id} item={item} index={i}>
 *         {item.name}
 *       </Typeahead.Item>
 *     ))}
 *     <Typeahead.Empty />
 *     <Typeahead.Create />
 *   </Typeahead.Dropdown>
 * </Typeahead.Root>
 * ```
 */
export const Typeahead = {
  Root: TypeaheadRoot,
  Input: TypeaheadInput,
  Dropdown: TypeaheadDropdown,
  Item: TypeaheadItem,
  Loading: TypeaheadLoading,
  Empty: TypeaheadEmpty,
  Create: TypeaheadCreate,
} as const;
