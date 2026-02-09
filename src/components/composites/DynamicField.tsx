// src/components/composites/DynamicField.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { SchemaField } from "../../api-client/data-models";

interface DynamicFieldProps {
  field: SchemaField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Renders a form field based on its schema definition.
 * Supports: text, number, enum (dropdown), unit (number with suffix)
 */
export function DynamicField({
  field,
  value,
  onChange,
  disabled = false,
}: DynamicFieldProps) {
  const inputId = `field-${field.name}`;

  const baseInputClasses = `w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    bg-white text-gray-900 placeholder-gray-400
    disabled:bg-gray-100 disabled:text-gray-500`;

  switch (field.type) {
    case "enum":
      return (
        <div className="mb-4">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClasses}
            required={field.required}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "unit":
      return (
        <div className="mb-4">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="relative">
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={`${baseInputClasses} pr-12`}
              placeholder={`e.g., 10k`}
              required={field.required}
            />
            {field.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      );

    case "number":
      return (
        <div className="mb-4">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            id={inputId}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClasses}
            required={field.required}
          />
        </div>
      );

    case "text":
    default:
      return (
        <div className="mb-4">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClasses}
            required={field.required}
          />
        </div>
      );
  }
}

export default DynamicField;
