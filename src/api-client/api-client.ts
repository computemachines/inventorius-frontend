import fetch from "cross-fetch";
import { json, response } from "express";
import { createContext } from "react";

import {
  Bin,
  RestOperation,
  CallableRestOperation,
  NextBin,
  Problem,
  Sku,
  SearchResults,
  NextSku,
  NextBatch,
  Batch,
  ApiStatus,
  Status,
  Stats,
  Category,
  Mixin,
  SchemaField,
  CategorySearchResult,
  MixinSearchResult,
  CodeUsageResult,
  CodeUsageRef,
  // Unified trigger field model
  AttributeBundle,
  TriggerFieldDef,
  BundleLookupResult,
  BundleContext,
} from "./data-models";

// =============================================================================
// Mock Schema Data (for adaptive typeahead prototype)
// =============================================================================

const MOCK_CATEGORIES: Category[] = [
  {
    id: "resistor",
    name: "Resistor",
    mixinTriggerField: "package",
    fields: [
      { name: "resistance", label: "Resistance", type: "unit", unit: "Ω", required: true },
      { name: "tolerance", label: "Tolerance", type: "enum", options: ["1%", "5%", "10%"], default: "5%" },
      { name: "package", label: "Package", type: "enum", options: ["0201", "0402", "0603", "0805", "1206", "through-hole"] },
    ],
  },
  {
    id: "capacitor",
    name: "Capacitor",
    mixinTriggerField: "package",
    fields: [
      { name: "capacitance", label: "Capacitance", type: "unit", unit: "F", required: true },
      { name: "voltage", label: "Voltage Rating", type: "unit", unit: "V" },
      { name: "package", label: "Package", type: "enum", options: ["0201", "0402", "0603", "0805", "1206", "through-hole", "radial"] },
    ],
  },
  {
    id: "resonator",
    name: "Resonator",
    mixinTriggerField: "package",
    fields: [
      { name: "frequency", label: "Frequency", type: "unit", unit: "Hz", required: true },
      { name: "package", label: "Package", type: "enum", options: ["SMD", "through-hole"] },
    ],
  },
  {
    id: "resin",
    name: "Resin",
    fields: [
      { name: "resinType", label: "Resin Type", type: "enum", options: ["epoxy", "polyester", "polyurethane"] },
      { name: "volume", label: "Volume", type: "unit", unit: "mL" },
    ],
  },
];

const MOCK_MIXINS: Mixin[] = [
  {
    id: "smd",
    name: "SMD Package",
    triggerValue: "0201",
    fields: [],
  },
  {
    id: "smd",
    name: "SMD Package",
    triggerValue: "0402",
    fields: [],
  },
  {
    id: "smd",
    name: "SMD Package",
    triggerValue: "0603",
    fields: [],
  },
  {
    id: "smd",
    name: "SMD Package",
    triggerValue: "0805",
    fields: [],
  },
  {
    id: "smd",
    name: "SMD Package",
    triggerValue: "1206",
    fields: [],
  },
  {
    id: "through-hole",
    name: "Through-hole Package",
    triggerValue: "through-hole",
    fields: [
      { name: "wireGauge", label: "Wire Gauge", type: "unit", unit: "AWG" },
    ],
  },
];

/** Intersection fields: category + mixin combinations */
const MOCK_INTERSECTIONS: Record<string, Record<string, SchemaField[]>> = {
  resistor: {
    smd: [
      { name: "tempCoeff", label: "Temp Coefficient", type: "unit", unit: "ppm/°C" },
    ],
  },
  capacitor: {
    smd: [
      { name: "dielectric", label: "Dielectric", type: "enum", options: ["C0G", "X5R", "X7R", "Y5V"] },
    ],
  },
};

// =============================================================================
// Unified Bundle Mock Data
// =============================================================================

/**
 * Trigger field definitions for each entity type.
 * These define which fields in the form can trigger bundle lookups.
 */
const TRIGGER_FIELDS: Record<string, TriggerFieldDef[]> = {
  sku: [
    {
      name: "itemType",
      label: "Item Type",
      matchType: "typeahead",
      placeholder: "Resistor, Capacitor, Battery...",
    },
    // Note: "package" trigger is defined within item type bundles
  ],
  batch: [
    {
      name: "source",
      label: "Source",
      matchType: "typeahead",
      placeholder: "DigiKey, Amazon, eBay...",
    },
  ],
};

/**
 * SKU Item Type bundles (replaces MOCK_CATEGORIES conceptually)
 */
const SKU_ITEM_TYPE_BUNDLES: AttributeBundle[] = [
  {
    id: "resistor",
    name: "Resistor",
    fields: [
      { name: "resistance", label: "Resistance", type: "unit", unit: "Ω", required: true },
      { name: "tolerance", label: "Tolerance", type: "enum", options: ["1%", "5%", "10%"], default: "5%" },
      { name: "package", label: "Package", type: "enum", options: ["0201", "0402", "0603", "0805", "1206", "through-hole"] },
    ],
  },
  {
    id: "capacitor",
    name: "Capacitor",
    fields: [
      { name: "capacitance", label: "Capacitance", type: "unit", unit: "F", required: true },
      { name: "voltage", label: "Voltage Rating", type: "unit", unit: "V" },
      { name: "package", label: "Package", type: "enum", options: ["0201", "0402", "0603", "0805", "1206", "through-hole", "radial"] },
    ],
  },
  {
    id: "resonator",
    name: "Resonator",
    fields: [
      { name: "frequency", label: "Frequency", type: "unit", unit: "Hz", required: true },
      { name: "package", label: "Package", type: "enum", options: ["SMD", "through-hole"] },
    ],
  },
  {
    id: "resin",
    name: "Resin",
    fields: [
      { name: "resinType", label: "Resin Type", type: "enum", options: ["epoxy", "polyester", "polyurethane"] },
      { name: "volume", label: "Volume", type: "unit", unit: "mL" },
    ],
  },
];

/**
 * SKU Package bundles (triggered by package field value)
 */
const SKU_PACKAGE_BUNDLES: AttributeBundle[] = [
  {
    id: "smd",
    name: "SMD Package",
    fields: [],  // SMD itself adds no fields; intersection with item type adds fields
  },
  {
    id: "through-hole",
    name: "Through-hole Package",
    fields: [
      { name: "wireGauge", label: "Wire Gauge", type: "unit", unit: "AWG" },
    ],
  },
];

/**
 * Mapping from package field values to bundle IDs
 */
const PACKAGE_VALUE_TO_BUNDLE: Record<string, string> = {
  "0201": "smd",
  "0402": "smd",
  "0603": "smd",
  "0805": "smd",
  "1206": "smd",
  "SMD": "smd",
  "through-hole": "through-hole",
  "radial": "through-hole",  // radial is through-hole style
};

/**
 * Batch Source bundles
 */
const BATCH_SOURCE_BUNDLES: AttributeBundle[] = [
  {
    id: "digikey",
    name: "DigiKey",
    fields: [
      { name: "orderNumber", label: "Order Number", type: "text" },
      { name: "shipDate", label: "Ship Date", type: "text" },
      { name: "costPerUnit", label: "Cost/Unit", type: "unit", unit: "$" },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    fields: [
      { name: "orderId", label: "Order ID", type: "text" },
      { name: "deliveryDate", label: "Delivery Date", type: "text" },
      { name: "returnDeadline", label: "Return Deadline", type: "text" },
    ],
  },
  {
    id: "ebay",
    name: "eBay",
    fields: [
      { name: "listingId", label: "Listing ID", type: "text" },
      { name: "sellerRating", label: "Seller Rating", type: "text" },
      { name: "conditionNotes", label: "Condition Notes", type: "text" },
    ],
  },
  {
    id: "mouser",
    name: "Mouser",
    fields: [
      { name: "orderNumber", label: "Order Number", type: "text" },
      { name: "shipDate", label: "Ship Date", type: "text" },
      { name: "costPerUnit", label: "Cost/Unit", type: "unit", unit: "$" },
    ],
  },
];

/**
 * Intersection fields for bundle combinations
 * Key format: "bundleId1:bundleId2" (alphabetically sorted)
 */
const BUNDLE_INTERSECTIONS: Record<string, SchemaField[]> = {
  "resistor:smd": [
    { name: "tempCoeff", label: "Temp Coefficient", type: "unit", unit: "ppm/°C" },
  ],
  "capacitor:smd": [
    { name: "dielectric", label: "Dielectric", type: "enum", options: ["C0G", "X5R", "X7R", "Y5V"] },
  ],
};

/**
 * Mock code usage data - simulates which SKUs/batches share certain codes.
 * In production, this would be a database lookup.
 */
const MOCK_CODE_USAGE: Record<string, CodeUsageRef[]> = {
  // Codes shared by multiple SKUs (associated)
  "RC0402FR": [
    { type: "sku", id: "SKU000012", name: "10kΩ 0402 Resistor (DigiKey)", relationship: "associated" },
    { type: "sku", id: "SKU000045", name: "10kΩ 0402 Resistor (Mouser)", relationship: "associated" },
  ],
  "ACME": [
    { type: "sku", id: "SKU000012", name: "10kΩ 0402 Resistor (DigiKey)", relationship: "associated" },
    { type: "sku", id: "SKU000013", name: "4.7kΩ 0402 Resistor", relationship: "associated" },
    { type: "sku", id: "SKU000099", name: "100Ω 0805 Resistor", relationship: "associated" },
  ],
  "0402": [
    { type: "sku", id: "SKU000012", name: "10kΩ 0402 Resistor (DigiKey)", relationship: "associated" },
    { type: "sku", id: "SKU000013", name: "4.7kΩ 0402 Resistor", relationship: "associated" },
    { type: "sku", id: "SKU000045", name: "10kΩ 0402 Resistor (Mouser)", relationship: "associated" },
    { type: "sku", id: "SKU000050", name: "100nF 0402 Capacitor", relationship: "associated" },
  ],
  // Codes owned by a single SKU
  "012345678901": [
    { type: "sku", id: "SKU000012", name: "10kΩ 0402 Resistor (DigiKey)", relationship: "owned" },
  ],
  // Batch-level codes (for future reference)
  "LOT-2024-001": [
    { type: "batch", id: "BAT000001", name: "DigiKey Order #123", relationship: "owned" },
  ],
};

export interface FrontloadContext {
  api: ApiClient;
}

/**
 * Inventorius API client
 */
export class ApiClient {
  hostname: string;


  constructor(hostname = "") {
    this.hostname = hostname;
  }


  hydrate<T extends Sku | Batch>(server_rendered: T): T {
    if (Object.getPrototypeOf(server_rendered) !== Object.prototype)
      return server_rendered;
    switch (server_rendered.kind) {
    case "sku":
      Object.setPrototypeOf(server_rendered, Sku.prototype);
      break;
    case "batch":
      Object.setPrototypeOf(server_rendered, Batch.prototype);
      break;
    default:
        let _exhaustive_check: never; // eslint-disable-line
    }
    for (const key in server_rendered.operations) {
      Object.setPrototypeOf(
        server_rendered.operations[key],
        CallableRestOperation.prototype
      );
      server_rendered.operations[key].hostname = this.hostname;
    }
    return server_rendered;
  }


  async getStatus(): Promise<ApiStatus> {
    const resp = await fetch(`${this.hostname}/api/status`);
    if (!resp.ok) throw Error(`${this.hostname}/api/status returned error code`);
    return new ApiStatus({ ... await resp.json(), hostname: this.hostname });
  }


  async getStats(): Promise<Stats> {
    const resp = await fetch(`${this.hostname}/api/stats`);
    if (!resp.ok) throw Error(`${this.hostname}/api/stats returned error code`);
    const json = await resp.json();
    return { ...json, kind: "stats" };
  }


  async getNextBin(): Promise<NextBin> {
    const resp = await fetch(`${this.hostname}/api/next/bin`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/bin returned error status`);
    return new NextBin({ ...json, hostname: this.hostname });
  }


  async getNextSku(): Promise<NextSku> {
    const resp = await fetch(`${this.hostname}/api/next/sku`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextSku({ ...json, hostname: this.hostname });
  }


  async getNextBatch(): Promise<NextBatch> {
    const resp = await fetch(`${this.hostname}/api/next/batch`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextBatch({ ...json, hostname: this.hostname });
  }


  async getSearchResults(params: {
    query: string;
    limit?: string;
    startingFrom?: string;
  }): Promise<SearchResults | Problem> {
    const resp = await fetch(
      `${this.hostname}/api/search?${new URLSearchParams(params).toString()}`
    );
    const json = await resp.json();

    if (resp.ok) return new SearchResults({ ...json });
    else return { ...json, kind: "problem" };
  }


  async getBin(id: string): Promise<Bin | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${id}`);
    const json = await resp.json();

    if (resp.ok) return new Bin({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createBin({ id, props }: { id: string; props?: unknown }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bins`, {
      method: "POST",
      body: JSON.stringify({ id, props }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async getSku(id: string): Promise<Sku | Problem> {
    const resp = await fetch(`${this.hostname}/api/sku/${id}`);
    const json = await resp.json();
    if (resp.ok) return new Sku({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createSku(params: {
    id: string;
    name: string;
    props?: unknown;
    owned_codes?: string[];
    associated_codes?: string[];
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/skus`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async getBatch(batch_id: string): Promise<Batch | Problem> {
    const resp = await fetch(`${this.hostname}/api/batch/${batch_id}`);
    const json = await resp.json();
    if (resp.ok) return new Batch({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createBatch(params: {
    id: string;
    sku_id?: string;
    name?: string;
    owned_codes?: string[];
    associated_codes?: string[];
    props?: unknown;
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/batches`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }


  async receive({
    into_id,
    item_id,
    quantity,
  }: {
    into_id: string;
    item_id: string;
    quantity: number;
  }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${into_id}/contents`, {
      method: "POST",
      body: JSON.stringify({
        id: item_id,
        quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }

  async release({ from_id, item_id, quantity }): Promise<Status | Problem> {
    const resp = await fetch(`${this.hostname}/api/bin/${from_id}/contents`, {
      method: "POST",
      body: JSON.stringify({
        id: item_id,
        quantity: -quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return {...json, kind: "status"};
    } else {
      return {...json, kind: "problem"};
    }
  }

  async move({ from_id, to_id, item_id, quantity }): Promise < Status | Problem > {
    const resp = await fetch(`${this.hostname}/api/bin/${from_id}/contents/move`, {
      method: "PUT",
      body: JSON.stringify({
        id: item_id,
        destination: to_id,
        quantity,
      }),
      headers: {
        "Content-Type": "application/json",
      }
    });
    const json = await resp.json();
    if(resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem" };
    }
  }

  // ===========================================================================
  // Mock Schema Methods (for adaptive typeahead prototype)
  // ===========================================================================

  /**
   * Search categories by name prefix (mock implementation)
   * In production, this would hit /api/schema/categories?q=...
   */
  async searchCategories(query: string): Promise<CategorySearchResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const normalizedQuery = query.toLowerCase().trim();
    const matches = MOCK_CATEGORIES.filter(cat =>
      cat.name.toLowerCase().startsWith(normalizedQuery)
    );

    return {
      kind: "category-search-result",
      categories: matches,
    };
  }

  /**
   * Get a category by ID (mock implementation)
   */
  async getCategory(categoryId: string): Promise<Category | null> {
    await new Promise(resolve => setTimeout(resolve, 20));
    return MOCK_CATEGORIES.find(c => c.id === categoryId) ?? null;
  }

  /**
   * Get mixins and intersection fields for a category + trigger value
   * (mock implementation)
   *
   * Example: getMixinsForCategory("resistor", "0402") returns:
   *   - SMD mixin (no extra fields)
   *   - Intersection fields: tempCoeff for Resistor+SMD
   */
  async getMixinsForCategory(
    categoryId: string,
    triggerValue: string
  ): Promise<MixinSearchResult> {
    await new Promise(resolve => setTimeout(resolve, 30));

    // Find mixins that match this trigger value
    const matchingMixins = MOCK_MIXINS.filter(m => m.triggerValue === triggerValue);

    // Collect intersection fields for each matching mixin
    let intersectionFields: SchemaField[] = [];
    for (const mixin of matchingMixins) {
      const categoryIntersections = MOCK_INTERSECTIONS[categoryId];
      if (categoryIntersections && categoryIntersections[mixin.id]) {
        intersectionFields = [
          ...intersectionFields,
          ...categoryIntersections[mixin.id],
        ];
      }
    }

    return {
      kind: "mixin-search-result",
      mixins: matchingMixins,
      intersectionFields,
    };
  }

  /**
   * Get all available categories (mock implementation)
   */
  async getAllCategories(): Promise<Category[]> {
    await new Promise(resolve => setTimeout(resolve, 30));
    return MOCK_CATEGORIES;
  }

  // ===========================================================================
  // Unified Bundle Methods (new trigger field model)
  // ===========================================================================

  /**
   * Get trigger field definitions for an entity type
   */
  getTriggerFields(entityType: "sku" | "batch"): TriggerFieldDef[] {
    return TRIGGER_FIELDS[entityType] || [];
  }

  /**
   * Search bundles by name (typeahead).
   * Used for trigger fields with matchType="typeahead".
   *
   * @param entityType - "sku" or "batch"
   * @param fieldName - which trigger field (e.g., "itemType", "source")
   * @param query - search query (prefix match)
   * @param context - current bundle context for computing intersections
   */
  async searchBundles(
    entityType: "sku" | "batch",
    fieldName: string,
    query: string,
    context: BundleContext
  ): Promise<BundleLookupResult> {
    await new Promise(resolve => setTimeout(resolve, 50));

    const normalizedQuery = query.toLowerCase().trim();
    let bundles: AttributeBundle[] = [];

    if (entityType === "sku" && fieldName === "itemType") {
      bundles = SKU_ITEM_TYPE_BUNDLES.filter(b =>
        b.name.toLowerCase().startsWith(normalizedQuery)
      );
    } else if (entityType === "batch" && fieldName === "source") {
      bundles = BATCH_SOURCE_BUNDLES.filter(b =>
        b.name.toLowerCase().startsWith(normalizedQuery)
      );
    }

    // Compute intersection fields
    const intersectionFields = this.computeIntersections(context, bundles);

    return {
      kind: "bundle-lookup-result",
      bundles,
      intersectionFields,
    };
  }

  /**
   * Get bundle by exact field value match.
   * Used for trigger fields with matchType="exact" (e.g., package dropdown).
   *
   * @param entityType - "sku" or "batch"
   * @param fieldName - which field triggered this (e.g., "package")
   * @param value - the exact value selected
   * @param context - current bundle context for computing intersections
   */
  async getBundleByValue(
    entityType: "sku" | "batch",
    fieldName: string,
    value: string,
    context: BundleContext
  ): Promise<BundleLookupResult> {
    await new Promise(resolve => setTimeout(resolve, 30));

    let bundles: AttributeBundle[] = [];

    if (entityType === "sku" && fieldName === "package") {
      const bundleId = PACKAGE_VALUE_TO_BUNDLE[value];
      if (bundleId) {
        const bundle = SKU_PACKAGE_BUNDLES.find(b => b.id === bundleId);
        if (bundle) {
          bundles = [bundle];
        }
      }
    }

    // Compute intersection fields
    const intersectionFields = this.computeIntersections(context, bundles);

    return {
      kind: "bundle-lookup-result",
      bundles,
      intersectionFields,
    };
  }

  /**
   * Compute intersection fields for a set of active bundles + new bundles
   */
  private computeIntersections(
    context: BundleContext,
    newBundles: AttributeBundle[]
  ): SchemaField[] {
    const allBundleIds = [
      ...context.activeBundleIds,
      ...newBundles.map(b => b.id),
    ];

    const intersectionFields: SchemaField[] = [];

    // Check all pairs for intersections
    for (let i = 0; i < allBundleIds.length; i++) {
      for (let j = i + 1; j < allBundleIds.length; j++) {
        // Sort alphabetically to create consistent key
        const pair = [allBundleIds[i], allBundleIds[j]].sort();
        const key = pair.join(":");

        if (BUNDLE_INTERSECTIONS[key]) {
          intersectionFields.push(...BUNDLE_INTERSECTIONS[key]);
        }
      }
    }

    return intersectionFields;
  }

  /**
   * Get a bundle by ID (for selecting from typeahead)
   */
  async getBundle(
    entityType: "sku" | "batch",
    fieldName: string,
    bundleId: string
  ): Promise<AttributeBundle | null> {
    await new Promise(resolve => setTimeout(resolve, 20));

    if (entityType === "sku" && fieldName === "itemType") {
      return SKU_ITEM_TYPE_BUNDLES.find(b => b.id === bundleId) ?? null;
    } else if (entityType === "sku" && fieldName === "package") {
      return SKU_PACKAGE_BUNDLES.find(b => b.id === bundleId) ?? null;
    } else if (entityType === "batch" && fieldName === "source") {
      return BATCH_SOURCE_BUNDLES.find(b => b.id === bundleId) ?? null;
    }

    return null;
  }

  // ===========================================================================
  // Mock Code Label Methods
  // ===========================================================================

  /**
   * Look up which SKUs/batches use a given code (mock implementation)
   * In production, this would hit /api/codes/{code}/usage
   */
  async getCodeUsage(code: string): Promise<CodeUsageResult> {
    await new Promise(resolve => setTimeout(resolve, 40));

    const usedBy = MOCK_CODE_USAGE[code] ?? [];

    return {
      kind: "code-usage-result",
      code,
      usedBy,
    };
  }
}

// Do not use this on the server side! Use react-frontload.
export const ApiContext = createContext<ApiClient>(new ApiClient(""));
