/**
 * Design system style constants for Typeahead components.
 *
 * Colors from the Inventorius design system:
 * - #04151f deep black (headers)
 * - #082441 dark navy (dropdowns)
 * - #0c3764 medium blue (hover/focus)
 * - #c0771f amber (accents)
 * - #cdd2d6 light gray (borders)
 * - #ecebe4 light text (on dark backgrounds)
 * - #26532b dark green (primary actions)
 */

export const styles = {
  // Input styles
  input:
    "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400",

  inputWithClear: "pr-8",

  // Clear button
  clearButton:
    "absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors",

  // Dropdown container
  dropdown:
    "absolute z-50 w-full mt-1 bg-[#082441] rounded-md shadow-lg border border-[#0c3764] max-h-60 overflow-auto",

  // Dropdown item
  item: "w-full text-left px-3 py-2 text-[#ecebe4] hover:bg-[#0c3764] transition-colors cursor-pointer",

  itemSelected: "bg-[#0c3764]",

  // Loading state
  loading: "px-3 py-2 text-[#ecebe4]/70 text-sm italic",

  // Empty state
  empty: "px-3 py-2 text-[#ecebe4]/70 text-sm italic",

  // Create new option
  create:
    "w-full text-left px-3 py-2 text-[#ecebe4] hover:bg-[#0c3764] transition-colors cursor-pointer border-t border-[#0c3764]/50",

  createIcon:
    "inline-flex items-center justify-center w-5 h-5 mr-2 rounded bg-[#c0771f]/20 text-[#c0771f] text-xs font-bold",

  // Container
  container: "relative",
} as const;
