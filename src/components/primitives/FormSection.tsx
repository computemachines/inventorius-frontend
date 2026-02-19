// src/components/primitives/FormSection.tsx
// Fully human reviewed: YES
// Progress: NONE
//
// Conversation:
// > (no discussion yet)

import * as React from "react";

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Full Tailwind bg class for the accent bar, e.g. "bg-dark-accent" */
  bgAccent?: string;
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
  bgAccent = "bg-dark-accent",
  withSeparator = true,
  className = "",
  children,
}: FormSectionProps) {
  return (
    <div
      className={`${
        withSeparator ? "mt-7 pt-5 border-t-2 border-abyss" : ""
      } ${className}`}
    >
      <h3 className="text-base font-bold text-dark1 mb-3 flex items-center gap-2">
        <span className={`block w-1 h-5 ${bgAccent} rounded-xsm`}></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default FormSection;
