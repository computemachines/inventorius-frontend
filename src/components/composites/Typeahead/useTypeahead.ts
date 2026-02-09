// src/components/composites/Typeahead/useTypeahead.ts
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import { useState, useCallback, useRef, useEffect, useMemo } from "react";

/**
 * Core typeahead hook that manages all state and behavior.
 * Can be used with local items or async search.
 */

export interface UseTypeaheadOptions<T> {
  /** Local data source - filtered client-side */
  items?: T[];
  /** Async data source - fetched server-side */
  onSearch?: (query: string) => Promise<T[]>;
  /** Extract display text from item */
  getItemText: (item: T) => string;
  /** Extract unique key from item */
  getItemKey: (item: T) => string;
  /** Debounce delay for async search (default: 150ms) */
  debounceMs?: number;
  /** Minimum characters before searching (default: 1) */
  minChars?: number;
  /** Called when an item is selected */
  onSelect?: (item: T) => void;
  /** Called when "create new" is chosen */
  onCreate?: (inputValue: string) => void;
  /** Controlled input value */
  value?: string;
  /** Called when input value changes (controlled mode) */
  onChange?: (value: string) => void;
  /** Whether to allow creating new items */
  allowCreate?: boolean;
}

export interface UseTypeaheadReturn<T> {
  /** Current input value */
  inputValue: string;
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Current list of items (filtered/fetched) */
  items: T[];
  /** Whether async search is loading */
  isLoading: boolean;
  /** Whether items list is empty (after search) */
  isEmpty: boolean;
  /** Whether we've searched at least once */
  hasSearched: boolean;
  /** Index of keyboard-selected item */
  selectedIndex: number | null;
  /** Currently selected item (if any) */
  selectedItem: T | null;
  /** Select an item */
  select: (item: T) => void;
  /** Clear input and selection */
  clear: () => void;
  /** Handle keyboard navigation */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Handle input change */
  handleInputChange: (value: string) => void;
  /** Open the dropdown */
  open: () => void;
  /** Close the dropdown */
  close: () => void;
  /** Container ref for click-outside detection */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Input ref */
  inputRef: React.RefObject<HTMLInputElement>;
  /** Generate ARIA input props */
  getInputProps: () => InputProps;
  /** Generate ARIA list props */
  getListProps: () => ListProps;
  /** Generate ARIA item props */
  getItemProps: (item: T, index: number) => ItemProps;
  /** Whether "create new" should be shown */
  showCreate: boolean;
  /** Handle create action */
  handleCreate: () => void;
}

interface InputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  role: "combobox";
  "aria-expanded": boolean;
  "aria-haspopup": "listbox";
  "aria-controls": string;
  "aria-activedescendant": string | undefined;
  "aria-autocomplete": "list";
  autoComplete: "off";
}

interface ListProps {
  role: "listbox";
  id: string;
  "aria-label": string;
}

interface ItemProps {
  id: string;
  role: "option";
  "aria-selected": boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
}

function clamp(v: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

let idCounter = 0;
function generateId(): string {
  return `typeahead-${++idCounter}`;
}

export function useTypeahead<T>(
  options: UseTypeaheadOptions<T>
): UseTypeaheadReturn<T> {
  const {
    items: localItems,
    onSearch,
    getItemText,
    getItemKey,
    debounceMs = 150,
    minChars = 1,
    onSelect,
    onCreate,
    value: controlledValue,
    onChange: onControlledChange,
    allowCreate = false,
  } = options;

  // Unique ID for ARIA
  const [listId] = useState(() => generateId());

  // Controlled vs uncontrolled input value
  const [uncontrolledValue, setUncontrolledValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const inputValue = isControlled ? controlledValue : uncontrolledValue;
  const setInputValue = useCallback(
    (value: string) => {
      if (isControlled && onControlledChange) {
        onControlledChange(value);
      } else {
        setUncontrolledValue(value);
      }
    },
    [isControlled, onControlledChange]
  );

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [asyncItems, setAsyncItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute displayed items
  const items = useMemo(() => {
    if (onSearch) {
      // Async mode: use fetched items
      return asyncItems;
    } else if (localItems) {
      // Local mode: filter client-side
      if (!inputValue.trim()) return localItems;
      const query = inputValue.toLowerCase();
      return localItems.filter((item) =>
        getItemText(item).toLowerCase().includes(query)
      );
    }
    return [];
  }, [onSearch, asyncItems, localItems, inputValue, getItemText]);

  const isEmpty = hasSearched && items.length === 0 && inputValue.trim().length >= minChars;
  const showCreate = allowCreate && isEmpty && inputValue.trim().length >= 2;

  // Debounced async search
  const searchAsync = useCallback(
    async (query: string) => {
      if (!onSearch) return;

      if (query.trim().length < minChars) {
        setAsyncItems([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await onSearch(query);
        setAsyncItems(results);
        setHasSearched(true);
        setSelectedIndex(results.length > 0 ? 0 : null);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch, minChars]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      setIsOpen(true);
      setSelectedItem(null);

      if (onSearch) {
        // Debounce async search
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          searchAsync(value);
        }, debounceMs);
      } else {
        // Local filtering is immediate
        setHasSearched(true);
        setSelectedIndex(items.length > 0 ? 0 : null);
      }
    },
    [setInputValue, onSearch, searchAsync, debounceMs, items.length]
  );

  // Handle item selection
  const select = useCallback(
    (item: T) => {
      const text = getItemText(item);
      setInputValue(text);
      setSelectedItem(item);
      setIsOpen(false);
      setSelectedIndex(null);
      onSelect?.(item);
    },
    [setInputValue, getItemText, onSelect]
  );

  // Handle create action
  const handleCreate = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && onCreate) {
      onCreate(trimmed);
      setIsOpen(false);
    }
  }, [inputValue, onCreate]);

  // Clear input and selection
  const clear = useCallback(() => {
    setInputValue("");
    setSelectedItem(null);
    setAsyncItems([]);
    setHasSearched(false);
    setSelectedIndex(null);
    inputRef.current?.focus();
  }, [setInputValue]);

  // Open dropdown
  const open = useCallback(() => {
    setIsOpen(true);
    if (inputValue.trim() && onSearch) {
      searchAsync(inputValue);
    } else if (localItems) {
      setHasSearched(true);
    }
  }, [inputValue, onSearch, searchAsync, localItems]);

  // Close dropdown
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(null);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = showCreate ? items.length : items.length - 1;

      if (!isOpen && e.key === "ArrowDown" && inputValue.trim()) {
        e.preventDefault();
        open();
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (selectedIndex === null) {
            setSelectedIndex(0);
          } else {
            setSelectedIndex(clamp(selectedIndex + 1, 0, maxIndex));
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (selectedIndex === null) {
            setSelectedIndex(maxIndex);
          } else {
            setSelectedIndex(clamp(selectedIndex - 1, 0, maxIndex));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex !== null) {
            if (showCreate && selectedIndex === items.length) {
              // "Create new" is selected
              handleCreate();
            } else if (items[selectedIndex]) {
              select(items[selectedIndex]);
            }
          }
          break;

        case "Tab":
          if (selectedIndex !== null) {
            if (showCreate && selectedIndex === items.length) {
              handleCreate();
            } else if (items[selectedIndex]) {
              select(items[selectedIndex]);
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [isOpen, items, selectedIndex, select, close, open, inputValue, showCreate, handleCreate]
  );

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [close]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ARIA props generators
  const getInputProps = useCallback(
    (): InputProps => ({
      value: inputValue,
      onChange: (e) => handleInputChange(e.target.value),
      onKeyDown: handleKeyDown,
      onFocus: () => {
        if (inputValue.trim()) {
          open();
        }
      },
      role: "combobox",
      "aria-expanded": isOpen,
      "aria-haspopup": "listbox",
      "aria-controls": listId,
      "aria-activedescendant":
        selectedIndex !== null ? `${listId}-option-${selectedIndex}` : undefined,
      "aria-autocomplete": "list",
      autoComplete: "off",
    }),
    [inputValue, handleInputChange, handleKeyDown, isOpen, listId, selectedIndex, open]
  );

  const getListProps = useCallback(
    (): ListProps => ({
      role: "listbox",
      id: listId,
      "aria-label": "Suggestions",
    }),
    [listId]
  );

  const getItemProps = useCallback(
    (item: T, index: number): ItemProps => ({
      id: `${listId}-option-${index}`,
      role: "option",
      "aria-selected": index === selectedIndex,
      onMouseDown: (e) => {
        e.preventDefault(); // Prevent blur before click
        select(item);
      },
      onMouseEnter: () => setSelectedIndex(index),
    }),
    [listId, selectedIndex, select]
  );

  return {
    inputValue,
    isOpen,
    items,
    isLoading,
    isEmpty,
    hasSearched,
    selectedIndex,
    selectedItem,
    select,
    clear,
    handleKeyDown,
    handleInputChange,
    open,
    close,
    containerRef,
    inputRef,
    getInputProps,
    getListProps,
    getItemProps,
    showCreate,
    handleCreate,
  };
}
