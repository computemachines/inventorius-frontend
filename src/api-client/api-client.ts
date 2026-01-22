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
