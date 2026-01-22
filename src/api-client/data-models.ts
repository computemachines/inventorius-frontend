import fetch from "cross-fetch";

export type Props = Record<string, unknown> | null;
export type Unit = Unit1;
export class Unit1 {
  unit: string;
  value: number;
  constructor({ unit, value }: { unit: string; value: number }) {
    this.unit = unit;
    this.value = value;
  }
}

export class Currency extends Unit1 {}
export class USD extends Currency {
  unit: "USD";
  constructor(value: number) {
    super({ unit: "USD", value });
  }
}

async function status_or_problem(
  resp_promise: Promise<Response>
): Promise<Status | Problem> {
  const resp = await resp_promise;
  const json = await resp.json();
  if (resp.ok) {
    return { ...json, kind: "status" };
  } else {
    return { ...json, kind: "problem" };
  }
}

/**
 * JSON representation of a 'application/problem+json' response.
 */
export interface Problem {
  /**
   * Discriminator
   */
  kind: "problem";
  type: string;
  title: string;
  "invalid-params"?: Array<{ name: string; reason: string }>;
}

/**
 * Type returned by resource creation or update api calls when successful.
 * For example, POST /api/skus might return:
 *   {kind: "status", Id: "/sku/SKU000001", status: "sku successfully created"}
 */
export interface Status {
  /**
   * Discriminator
   */
  kind: "status";
  /**
   * URI of the newly created resource.
   */
  Id: string;
  /**
   * Human readable status string.
   */
  status: string;
}

class RestEndpoint {
  state: unknown;
  operations: Record<string, CallableRestOperation>;
  constructor({
    state,
    operations,
    hostname,
  }: {
    state: unknown;
    operations: RestOperation[];
    hostname: string;
  }) {
    this.state = state;
    this.operations = {};
    for (const op of operations) {
      this.operations[op.rel] = new CallableRestOperation({ hostname, ...op });
    }
  }
}

export interface RestOperation {
  rel: string;
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export class CallableRestOperation implements RestOperation {
  rel: string;
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  hostname: string;
  constructor(config: {
    rel: string;
    href: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    hostname: string;
  }) {
    Object.assign(this, config);
  }

  perform({
    body,
    json,
  }: {
    body?: string;
    json?: unknown;
  } = {}): Promise<Response> {
    if (body) {
      return fetch(`${this.hostname}${this.href}`, {
        method: this.method,
        body,
      });
    } else if (json) {
      return fetch(`${this.hostname}${this.href}`, {
        method: this.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(json),
      });
    } else {
      return fetch(`${this.hostname}${this.href}`, {
        method: this.method,
      });
    }
  }
}

export class ApiStatus extends RestEndpoint {
  kind: "api-status" = "api-status";
  state: {
    version: string;
    "is-ok": boolean;
  };
}

export interface Stats {
  kind: "stats";
  counts: {
    bins: number;
    skus: number;
    batches: number;
  };
  recent_bins: Array<{ id: string; props: Record<string, unknown> }>;
  recent_skus: Array<{ id: string; name: string }>;
}

export interface BinState {
  id: string;
  contents: Record<string, number>;
  props?: Props;
}
export class Bin extends RestEndpoint {
  kind: "bin" = "bin";
  state: BinState;
  operations: {
    delete: CallableRestOperation;
    update: CallableRestOperation;
  };

  update(patch: { props: Props }): Promise<Status | Problem> {
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }

  delete(): Promise<Status | Problem> {
    return status_or_problem(this.operations.delete.perform());
  }
}

type BinId = string;
type SkuId = string;
type BatchId = string;
export interface SkuLocations {
  kind: "sku-locations";
  state: Record<BinId, Record<SkuId, number>>;
}
interface SkuBatches {
  kind: "sku-batches";
  state: BatchId[];
}
export interface BatchLocations {
  kind: "batch-locations";
  state: Record<BinId, Record<BatchId, number>>;
}

export interface SkuState {
  id: string;
  owned_codes: string[];
  associated_codes: string[];
  name?: string;
  props?: Props;
}
export class Sku extends RestEndpoint {
  kind: "sku" = "sku";
  state: SkuState;
  operations: {
    update: CallableRestOperation;
    delete: CallableRestOperation;
    bins: CallableRestOperation;
    batches: CallableRestOperation;
  };
  update(patch: {
    name?: string;
    owned_codes?: string[];
    associated_codes?: string[];
    props?: Props;
  }): Promise<Status | Problem> {
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }
  delete(): Promise<Status | Problem> {
    return status_or_problem(this.operations.delete.perform());
  }
  async bins(): Promise<SkuLocations | Problem> {
    const resp = await this.operations.bins.perform();
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "sku-locations" };
    else return { ...json, kind: "problem" };
  }
  async batches(): Promise<SkuBatches | Problem> {
    const resp = await this.operations.batches.perform();
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "sku-batches" };
    else return { ...json, kind: "problem" };
  }
}

export interface BatchState {
  id: string;
  sku_id?: string;
  name?: string;
  owned_codes?: string[];
  associated_codes?: string[];
  props?: Props;
}
export class Batch extends RestEndpoint {
  kind: "batch" = "batch";
  state: BatchState;
  operations: {
    update: CallableRestOperation;
    delete: CallableRestOperation;
    bins: CallableRestOperation;
  };
  update(patch: {
    id: string;
    sku_id?: string;
    name?: string;
    owned_codes?: string[];
    associated_codes?: string[];
    props?: Props;
  }): Promise<Status | Problem> {
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }
  delete(): Promise<Status | Problem> {
    return status_or_problem(this.operations.delete.perform());
  }
  async bins(): Promise<BatchLocations | Problem> {
    const resp = await this.operations.bins.perform();
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "batch-locations" };
    else return { ...json, kind: "problem" };
  }
}

export class NextBin extends RestEndpoint {
  kind: "next-bin" = "next-bin";
  state: string;
  operations: {
    create: CallableRestOperation;
  };

  create(): Promise<Response> {
    return this.operations.create.perform({ json: { id: this.state } });
  }
}

export class NextSku extends RestEndpoint {
  kind: "next-sku" = "next-sku";
  state: string;
  operations: {
    create: CallableRestOperation;
  };

  create(): Promise<Response> {
    return this.operations.create.perform({ json: { id: this.state } });
  }
}

export class NextBatch extends RestEndpoint {
  kind: "next-batch" = "next-batch";
  state: string;
  operations: {
    create: CallableRestOperation;
  };

  create(): Promise<Response> {
    return this.operations.create.perform({ json: { id: this.state } });
  }
}

export type SearchResult = SkuState | BatchState | BinState;
export class SearchResults extends RestEndpoint {
  kind: "search-results" = "search-results";
  state: {
    total_num_results: number;
    starting_from: number;
    limit: number;
    returned_num_results: number;
    results: SearchResult[];
  };
  operations: null;
}
export function isSkuState(result: SearchResult): result is SkuState {
  return result.id.startsWith("SKU");
}
export function isBinState(result: SearchResult): result is BinState {
  return result.id.startsWith("BIN");
}
export function isBatchState(result: SearchResult): result is BatchState {
  return result.id.startsWith("BAT");
}

// =============================================================================
// Schema Types (for adaptive typeahead / dynamic form)
// =============================================================================

/**
 * Field types for dynamic form generation
 */
export type FieldType = "text" | "number" | "enum" | "unit";

/**
 * A single attribute/field in a category or mixin
 */
export interface SchemaField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For enum type: the allowed values */
  options?: string[];
  /** For unit type: the unit suffix (e.g., "Ω", "ppm/°C") */
  unit?: string;
  /** Default value */
  default?: string | number;
}

/**
 * A category defines a type of item with its attributes
 */
export interface Category {
  id: string;
  name: string;
  /** Fields that appear for all items in this category */
  fields: SchemaField[];
  /** Which field triggers mixin selection (e.g., "package") */
  mixinTriggerField?: string;
}

/**
 * A mixin adds additional fields based on some attribute value
 * (e.g., package=SMD adds tempCoeff field)
 */
export interface Mixin {
  id: string;
  name: string;
  /** The trigger field value that activates this mixin */
  triggerValue: string;
  /** Additional fields this mixin adds */
  fields: SchemaField[];
}

/**
 * Intersection fields: appear when both a category AND a mixin are active
 * (e.g., Resistor + SMD gets tempCoeff)
 */
export interface IntersectionFields {
  categoryId: string;
  mixinId: string;
  fields: SchemaField[];
}

/**
 * Result from category search
 */
export interface CategorySearchResult {
  kind: "category-search-result";
  categories: Category[];
}

/**
 * Result from mixin search (given a category and trigger field value)
 */
export interface MixinSearchResult {
  kind: "mixin-search-result";
  mixins: Mixin[];
  intersectionFields: SchemaField[];
}

// =============================================================================
// Code Label Types
// =============================================================================

/**
 * Reference to an entity that shares a code
 */
export interface CodeUsageRef {
  type: "sku" | "batch";
  id: string;
  name?: string;
  relationship: "owned" | "associated";
}

/**
 * Result from code usage lookup - shows what other entities share a code
 */
export interface CodeUsageResult {
  kind: "code-usage-result";
  code: string;
  usedBy: CodeUsageRef[];
}
