import * as React from "react";
import { useState, useContext, useRef, useEffect, useCallback } from "react";

import { ApiContext } from "../api-client/api-client";
import { Category } from "../api-client/data-models";

interface CategoryAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (category: Category) => void;
  className?: string;
  placeholder?: string;
  debounceMs?: number;
}

function clamp(v: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Autocomplete input for selecting a category.
 * Queries the API on each keystroke (debounced) and allows selection
 * via keyboard (ArrowUp/Down, Enter, Tab) or mouse click.
 */
export function CategoryAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  className = "",
  placeholder = "Type to search categories...",
  debounceMs = 150,
}: CategoryAutocompleteProps) {
  const api = useContext(ApiContext);

  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Category[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const searchCategories = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const result = await api.searchCategories(query);
        setSuggestions(result.categories);
        setSelectedIndex(result.categories.length > 0 ? 0 : null);
      } finally {
        setIsLoading(false);
      }
    },
    [api]
  );

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounced search
    debounceRef.current = setTimeout(() => {
      searchCategories(newValue);
    }, debounceMs);
  };

  // Handle selection
  const handleSelect = (category: Category) => {
    onChange(category.name);
    onSelect(category);
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(null);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      // Open dropdown on arrow down even when closed
      if (e.key === "ArrowDown" && value.trim()) {
        setIsOpen(true);
        searchCategories(value);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === null ? 0 : clamp(prev + 1, 0, suggestions.length - 1)
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === null
            ? suggestions.length - 1
            : clamp(prev - 1, 0, suggestions.length - 1)
        );
        break;

      case "Enter":
        e.preventDefault();
        if (selectedIndex !== null && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;

      case "Tab":
        if (selectedIndex !== null && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;

      case "Escape":
        setIsOpen(false);
        setSelectedIndex(null);
        break;
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const listId = id ? `${id}-listbox` : "category-listbox";

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-owns={listId}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value.trim()) {
            setIsOpen(true);
            searchCategories(value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          selectedIndex !== null ? `${listId}-option-${selectedIndex}` : undefined
        }
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   bg-white text-gray-900 placeholder-gray-400"
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          id={listId}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200
                     rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
          aria-label="Categories"
        >
          {suggestions.map((category, index) => (
            <li
              key={category.id}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`px-3 py-2 cursor-pointer text-gray-900
                ${index === selectedIndex
                  ? "bg-blue-100 text-blue-900"
                  : "hover:bg-gray-100"
                }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click registers
                handleSelect(category);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {category.name}
            </li>
          ))}
        </ul>
      )}
      {isOpen && isLoading && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200
                       rounded-md shadow-lg" role="listbox">
          <li className="px-3 py-2 text-gray-500">Loading...</li>
        </ul>
      )}
      {isOpen && !isLoading && value.trim() && suggestions.length === 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200
                       rounded-md shadow-lg" role="listbox">
          <li className="px-3 py-2 text-gray-500">No categories found</li>
        </ul>
      )}
    </div>
  );
}

export default CategoryAutocomplete;
