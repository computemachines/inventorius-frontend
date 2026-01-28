import * as React from "react";
import { useEffect, useState } from "react";
import { Currency, Props, Unit1, USD } from "../api-client/data-models";
import { CrossCircle } from "../img/lnr";
import PlusCircle from "../img/lnr/PlusCircle";

import "../styles/PropertiesTable.css";
import { TypeaheadField } from "./Typeahead";

// export type PropertyType = "string" | "date" | "integer" | "float" | "currency" | "physical-unit";
// export type PropertyType = "string";

const PropertyTypes: string[] = ["string", "currency", "number", "file"];

// UUID v4 regex for detecting file IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string looks like a UUID (potential file ID)
 */
export function isUuidString(value: string): boolean {
  return UUID_REGEX.test(value);
}

function defaultPropertyType(
  type: "string" | "currency" | "number"
): string | Currency | number {
  switch (type) {
    case "currency":
      return new USD(0);
      break;
    case "number":
      return 0;
      break;
    case "string":
      return "";
      break;
    default:
      throw new Error("Impossible fallthrough");
  }
}

export class Property {
  name: string;
  typed:
    | {
        kind: "string";
        value: string;
      }
    | {
        kind: "currency";
        value: Currency;
      }
    | {
        kind: "number";
        value: number;
      }
    | {
        kind: "file";
        value: string; // file_id (UUID)
      };
  constructor({ name, typed }) {
    this.name = name;
    this.typed = typed;
  }
  value(): string | number | Unit1 {
    switch (this.typed.kind) {
      case "currency":
        return this.typed.value;
      case "number":
        return this.typed.value;
      case "string":
        return this.typed.value;
      case "file":
        return this.typed.value;
    }
  }
}

export function api_props_from_properties(properties: Property[]): Props {
  const ret = {};
  for (let i = 0; i < properties.length; i++) {
    ret[properties[i].name] = new Property(properties[i]).value();
  }
  return ret;
}

const defaultProperty: Property = new Property({
  name: "",
  typed: {
    kind: "string",
    value: "",
  },
});

const predefinedProperties: Property[] = [
  new Property({
    name: "original_cost_per_case",
    typed: {
      kind: "currency",
      value: new USD(0),
    },
  }),
  new Property({
    name: "original_count_per_case",
    typed: { kind: "number", value: 1 },
  }),
];

// ============================================================================
// File Value Display Component
// ============================================================================

interface FileMetadata {
  id: string;
  original_filename: string;
  content_type: string;
  size: number;
  is_image: boolean;
  has_thumbnail: boolean;
}

function FileValueDisplay({ fileId }: { fileId: string }) {
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      return;
    }

    // Fetch file metadata
    fetch(`/api/files/${fileId}/meta`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [fileId]);

  if (loading) {
    return <span className="text-[#6d635d] italic text-sm">Loading...</span>;
  }

  if (error || !metadata) {
    // Fallback: just show the file ID as a link
    return (
      <a
        href={`/api/files/${fileId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#0c3764] hover:underline text-sm font-mono"
      >
        {fileId.slice(0, 8)}...
      </a>
    );
  }

  // Image with thumbnail
  if (metadata.is_image && metadata.has_thumbnail) {
    return (
      <a
        href={`/api/files/${fileId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 group"
      >
        <img
          src={`/api/files/${fileId}/thumb`}
          alt={metadata.original_filename}
          className="w-12 h-12 object-cover rounded border border-[#cdd2d6] group-hover:border-[#0c3764] transition-colors"
        />
        <span className="text-sm text-[#6d635d] group-hover:text-[#0c3764] truncate max-w-[150px]">
          {metadata.original_filename}
        </span>
      </a>
    );
  }

  // Non-image file (PDF, etc.)
  return (
    <a
      href={`/api/files/${fileId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[#0c3764] hover:underline"
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <span className="text-sm truncate max-w-[150px]">
        {metadata.original_filename}
      </span>
    </a>
  );
}

function PropertyValueDisplay({ property }: { property: Property }) {
  switch (property.typed.kind) {
    case "file":
      return <FileValueDisplay fileId={property.typed.value} />;
    case "currency":
      return <span>${property.typed.value.value.toFixed(2)}</span>;
    case "number":
      return <span>{property.typed.value}</span>;
    case "string":
    default:
      return <span>{property.typed.value}</span>;
  }
}

function PropertyRow({
  property,
}: {
  property: Property;
  // setProperty: (property) => void;
}) {
  return (
    <>
      <div className="properties-table__name">{property.name}</div>
      <div className="properties-table__value">
        <PropertyValueDisplay property={property} />
      </div>
    </>
  );
}

function EditablePropertyInputRow({
  property,
  setProperty,
  insertProperty,
  deleteProperty,
  isLast,
}: {
  property: Property;
  setProperty: (property) => void;
  insertProperty: () => void;
  deleteProperty: () => void;
  isLast: boolean;
}) {
  const commonProps = {
    onChange(e) {
      const newTyped = { ...property.typed };
      newTyped.value = e.target.value;
      setProperty({ ...property, typed: newTyped });
    },
    onKeyDown(e) {
      if (e.key == "Tab" && property.name) {
        insertProperty();
      }
    },
    id: "property_" + property.name,
    name: "property_" + property.name,
  };
  if (!isLast) {
    delete commonProps.onKeyDown;
  }

  let valueInput;
  switch (property.typed.kind) {
    case "string":
      valueInput = (
        <input type="text" {...commonProps} value={property.typed.value} />
      );
      break;
    case "currency":
      valueInput = (
        <input
          type="number"
          value={property.typed.value.value}
          {...commonProps}
          onChange={(e) =>
            setProperty({
              ...property,
              typed: {
                kind: "currency",
                value: new USD(parseFloat(e.target.value)),
              },
            })
          }
        />
      );
      break;
    case "number":
      valueInput = (
        <input type="number" {...commonProps} value={property.typed.value} />
      );
      break;
    default:
      throw new Error("Impossible fallthrough");
  }

  return (
    <div className="properties-table-row">
      <TypeaheadField
        className="properties-table-row__name"
        value={property.name}
        onChange={(name) => setProperty({ ...property, name })}
        onSelect={(name) => {
          const predefined = predefinedProperties.find(
            (predefinedProperty) => name == predefinedProperty.name
          );
          if (typeof predefined !== "undefined") {
            setProperty({ ...predefined });
          } else {
            setProperty({ ...property, name });
          }
        }}
        items={predefinedProperties.map((property) => property.name)}
      />
      <select
        className="properties-table-row__type"
        disabled={predefinedProperties.some(
          (predefinedProperty) => predefinedProperty.name == property.name
        )}
        value={property.typed.kind}
        onChange={(e) =>
          setProperty({
            ...property,
            typed: {
              kind: e.target.value,
              value: defaultPropertyType(
                e.target.value as "number" | "string" | "currency"
              ),
            },
          })
        }
      >
        {PropertyTypes.map((type, i) => (
          <option key={i} value={type}>
            {type}
          </option>
        ))}
      </select>
      <div className="properties-table-row__value">{valueInput}</div>
      {isLast ? (
        <PlusCircle
          className="lnr-plus-circle properties-table-row__button"
          onClick={(e) => insertProperty()}
        />
      ) : (
        <CrossCircle
          className="lnr-cross-circle properties-table-row__button"
          onClick={(e) => deleteProperty()}
        />
      )}
    </div>
  );
}

function PropertiesTable({
  properties,
  setProperties,
  editable,
}: {
  properties: Property[];
  setProperties: (properties: Property[]) => void;
  editable: boolean;
}) {
  return (
    <div
      className={`properties-table ${
        editable ? "properties-table--editing" : ""
      }`}
    >
      {editable
        ? (properties.length == 0 ? [defaultProperty] : properties).map(
            (property, i, visibleProperties) => (
              <EditablePropertyInputRow
                key={i}
                property={property}
                setProperty={(newProperty) => {
                  const newProperties = [...visibleProperties];
                  newProperties[i] = newProperty;
                  setProperties(newProperties);
                }}
                insertProperty={() => {
                  setProperties([...properties, defaultProperty]);
                }}
                deleteProperty={() => {
                  const newProperties = [...visibleProperties];
                  newProperties.splice(i, 1);
                  setProperties(newProperties);
                }}
                isLast={i == visibleProperties.length - 1}
              />
            )
          )
        : properties.map((property, i, properties) => (
            <PropertyRow key={i} property={property} />
          ))}
    </div>
  );
}

export default PropertiesTable;
