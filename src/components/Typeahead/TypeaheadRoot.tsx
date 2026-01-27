import * as React from "react";
import { TypeaheadContext } from "./TypeaheadContext";
import { useTypeahead, UseTypeaheadOptions } from "./useTypeahead";
import { styles } from "./typeahead.styles";

export interface TypeaheadRootProps<T> extends UseTypeaheadOptions<T> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Root component that provides typeahead context to children.
 * Wraps the useTypeahead hook and shares state via context.
 */
export function TypeaheadRoot<T>({
  children,
  className = "",
  ...options
}: TypeaheadRootProps<T>) {
  const typeahead = useTypeahead<T>(options);

  return (
    <TypeaheadContext.Provider value={typeahead as unknown as ReturnType<typeof useTypeahead<unknown>>}>
      <div
        ref={typeahead.containerRef as React.RefObject<HTMLDivElement>}
        className={`${styles.container} ${className}`}
      >
        {children}
      </div>
    </TypeaheadContext.Provider>
  );
}
