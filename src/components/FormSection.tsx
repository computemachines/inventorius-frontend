import * as React from "react";

/**
 * Design system colors for section accents:
 * - blue (#0c3764) - primary sections
 * - amber (#c0771f) - secondary/dynamic sections
 * - green (#26532b) - action sections
 */
type AccentColor = "blue" | "amber" | "green";

const accentColors: Record<AccentColor, string> = {
  blue: "bg-[#0c3764]",
  amber: "bg-[#c0771f]",
  green: "bg-[#26532b]",
};

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Accent bar color */
  accent?: AccentColor;
  /** Whether to show top border separator */
  withSeparator?: boolean;
  /** Additional classes for the container */
  className?: string;
  /** Section content */
  children: React.ReactNode;
}

/**
 * Form section with styled header and optional separator.
 * Used to visually group related form fields.
 */
export function FormSection({
  title,
  accent = "blue",
  withSeparator = true,
  className = "",
  children,
}: FormSectionProps) {
  return (
    <div
      className={`${withSeparator ? "mt-7 pt-5 border-t-2 border-[#cdd2d6]" : ""} ${className}`}
    >
      <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
        <span className={`block w-1 h-5 ${accentColors[accent]} rounded-sm`}></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default FormSection;
