import fetch from "cross-fetch";
import { createContext } from "react";

import {
  Bin,
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
  CodeUsageResult,
  AttributeBundle,
  BundleLookupResult,
  BundleContext,
  CaptureResult,
  InventoryOperationCommand,
  InventoryOperationResult,
  ProcessDefinition,
  ProcessDefinitionState,
  ProcessDefinitionWrite,
} from "./data-models";

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


  private async _fetch(url: string, options?: RequestInit): Promise<Response> {
    const method = options?.method ?? "GET";
    const start = Date.now();
    console.log(`[api] ${method} ${url}`);
    try {
      const resp = await fetch(url, options);
      console.log(`[api] ${method} ${url} → ${resp.status} (${Date.now() - start}ms)`);
      return resp;
    } catch (err) {
      console.error(`[api] ${method} ${url} → FETCH ERROR (${Date.now() - start}ms)`, err);
      throw err;
    }
  }


  hydrate<T extends Sku | Batch | ProcessDefinition>(server_rendered: T): T {
    if (Object.getPrototypeOf(server_rendered) !== Object.prototype)
      return server_rendered;
    switch (server_rendered.kind) {
    case "sku":
      Object.setPrototypeOf(server_rendered, Sku.prototype);
      break;
    case "batch":
      Object.setPrototypeOf(server_rendered, Batch.prototype);
      break;
    case "process-definition":
      Object.setPrototypeOf(server_rendered, ProcessDefinition.prototype);
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
    const resp = await this._fetch(`${this.hostname}/api/status`);
    if (!resp.ok) throw Error(`${this.hostname}/api/status returned error code`);
    return new ApiStatus({ ... await resp.json(), hostname: this.hostname });
  }


  async getStats(): Promise<Stats> {
    const resp = await this._fetch(`${this.hostname}/api/stats`);
    if (!resp.ok) throw Error(`${this.hostname}/api/stats returned error code`);
    const json = await resp.json();
    return { ...json, kind: "stats" };
  }


  async quickCapture(params: {
    description: string;
    bin_id: string;
    quantity: number;
    unit: "each";
    observed_codes?: string[];
  }, idempotencyKey: string): Promise<CaptureResult | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/intake`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }


  async getNextBin(): Promise<NextBin> {
    const resp = await this._fetch(`${this.hostname}/api/next/bin`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/bin returned error status`);
    return new NextBin({ ...json, hostname: this.hostname });
  }


  async getNextSku(): Promise<NextSku> {
    const resp = await this._fetch(`${this.hostname}/api/next/sku`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextSku({ ...json, hostname: this.hostname });
  }


  async getNextBatch(): Promise<NextBatch> {
    const resp = await this._fetch(`${this.hostname}/api/next/batch`);
    const json = await resp.json();
    if (!resp.ok) throw Error(`${this.hostname}/api/next/sku returned error status`);
    return new NextBatch({ ...json, hostname: this.hostname });
  }


  async getSearchResults(params: {
    query: string;
    limit?: string;
    startingFrom?: string;
  }): Promise<SearchResults | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/search?${new URLSearchParams(params).toString()}`
    );
    const json = await resp.json();

    if (resp.ok) return new SearchResults({ ...json });
    else return { ...json, kind: "problem" };
  }


  async getBin(id: string): Promise<Bin | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/bin/${id}`);
    const json = await resp.json();

    if (resp.ok) return new Bin({ ...json, hostname: this.hostname });
    else return { ...json, kind: "problem" };
  }


  async createBin({ id, props }: { id: string; props?: unknown }): Promise<Status | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/bins`, {
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
    const resp = await this._fetch(`${this.hostname}/api/sku/${id}`);
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
    const resp = await this._fetch(`${this.hostname}/api/skus`, {
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
    const resp = await this._fetch(`${this.hostname}/api/batch/${batch_id}`);
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
    const resp = await this._fetch(`${this.hostname}/api/batches`, {
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


  async postInventoryOperation(
    command: InventoryOperationCommand,
    idempotencyKey: string,
  ): Promise<InventoryOperationResult | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/inventory-operations`, {
      method: "POST",
      body: JSON.stringify(command),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }

  // ===========================================================================
  // Bundle Search Methods (uses schema API)
  // ===========================================================================

  /**
   * Search bundles by name (typeahead).
   * Calls /api/schema/{entityType}/search to find child mixins triggered by a field.
   *
   * @param entityType - "sku" or "batch"
   * @param fieldName - which trigger field (e.g., "item_type", "source")
   * @param query - search query (prefix match)
   * @param context - current bundle context for computing intersections
   */
  async searchBundles(
    entityType: "sku" | "batch",
    fieldName: string,
    query: string,
    context: BundleContext
  ): Promise<BundleLookupResult> {
    const params = new URLSearchParams({
      field: fieldName,
      q: query,
    });

    if (context.activeBundleIds.length > 0) {
      params.set("active", context.activeBundleIds.join(","));
    }

    const resp = await this._fetch(
      `${this.hostname}/api/schema/${entityType}/search?${params.toString()}`
    );

    if (!resp.ok) {
      // Return empty result on error
      return {
        kind: "bundle-lookup-result",
        bundles: [],
        intersectionFields: [],
      };
    }

    const data = await resp.json();

    // Convert API response to BundleLookupResult
    return {
      kind: "bundle-lookup-result",
      bundles: data.bundles || [],
      intersectionFields: data.intersection_fields || [],
    };
  }

  /**
   * Get bundle by exact field value match.
   * Used for dropdown selections (e.g., package field triggers).
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
    const params = new URLSearchParams({
      field: fieldName,
      value: value,
    });

    if (context.activeBundleIds.length > 0) {
      params.set("active", context.activeBundleIds.join(","));
    }

    const resp = await this._fetch(
      `${this.hostname}/api/schema/${entityType}/search?${params.toString()}`
    );

    if (!resp.ok) {
      return {
        kind: "bundle-lookup-result",
        bundles: [],
        intersectionFields: [],
      };
    }

    const data = await resp.json();

    return {
      kind: "bundle-lookup-result",
      bundles: data.bundles || [],
      intersectionFields: data.intersection_fields || [],
    };
  }

  // ===========================================================================
  // Code Label Methods
  // ===========================================================================

  /**
   * Look up which SKUs/batches use a given code.
   */
  async getCodeUsage(code: string): Promise<CodeUsageResult> {
    const resp = await this._fetch(
      `${this.hostname}/api/codes/${encodeURIComponent(code)}/usage`,
    );
    if (!resp.ok) {
      throw Error(`${this.hostname}/api/codes returned error status`);
    }
    const result = await resp.json();

    return {
      ...result,
      kind: "code-usage-result",
    };
  }


  async listProcessDefinitions(
    query = ""
  ): Promise<ProcessDefinitionState[] | Problem> {
    const params = query ? `?${new URLSearchParams({ query }).toString()}` : "";
    const resp = await this._fetch(
      `${this.hostname}/api/process-definitions${params}`
    );
    const json = await resp.json();
    if (resp.ok) return json.state;
    return { ...json, kind: "problem" };
  }


  async getProcessDefinition(
    id: string,
    revision?: number
  ): Promise<ProcessDefinition | Problem> {
    const params = revision
      ? `?${new URLSearchParams({ revision: String(revision) }).toString()}`
      : "";
    const resp = await this._fetch(
      `${this.hostname}/api/process-definition/${id}${params}`
    );
    const json = await resp.json();
    if (resp.ok) {
      return new ProcessDefinition({ ...json, hostname: this.hostname });
    }
    return { ...json, kind: "problem" };
  }


  async createProcessDefinition(
    definition: ProcessDefinitionWrite
  ): Promise<Status | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/process-definitions`, {
      method: "POST",
      body: JSON.stringify(definition),
      headers: { "Content-Type": "application/json" },
    });
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }

  // ===========================================================================
  // Generic API Request (for schema admin and other endpoints)
  // ===========================================================================

  /**
   * Generic fetch wrapper with JSON support
   */
  async request<T>(path: string, method: string = "GET", body?: unknown): Promise<T> {
    const options: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const resp = await this._fetch(`${this.hostname}${path}`, options);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error((err as { error?: string; message?: string }).error ||
                      (err as { message?: string }).message ||
                      "Request failed");
    }
    return resp.json();
  }

  // ===========================================================================
  // Schema Admin Methods
  // ===========================================================================

  /**
   * List available schema names
   */
  async listSchemas(): Promise<string[]> {
    const data = await this.request<{ schemas: string[] }>("/api/schema/list");
    return data.schemas || [];
  }

  /**
   * Get a schema by name
   */
  async getSchema(schemaName: string): Promise<unknown> {
    return this.request(`/api/schema/${schemaName}`);
  }

  /**
   * Save a schema
   */
  async saveSchema(schemaName: string, schema: unknown): Promise<void> {
    await this.request(`/api/schema/${schemaName}`, "PUT", schema);
  }

  /**
   * Evaluate a schema with field values
   */
  async evaluateSchema(
    schemaName: string,
    activeMixins: string[],
    fieldValues: Record<string, string | boolean>
  ): Promise<{ active_mixins: string[]; available_fields: unknown[] }> {
    return this.request(`/api/schema/${schemaName}/evaluate`, "POST", {
      active_mixins: activeMixins,
      field_values: fieldValues,
    });
  }

  /**
   * Save a mixin in a schema
   */
  async saveMixin(schemaName: string, mixinName: string, mixin: unknown): Promise<void> {
    await this.request(`/api/schema/${schemaName}/mixin/${mixinName}`, "PUT", mixin);
  }

  /**
   * Delete a mixin from a schema
   */
  async deleteMixin(schemaName: string, mixinName: string): Promise<void> {
    await this.request(`/api/schema/${schemaName}/mixin/${mixinName}`, "DELETE");
  }

  /**
   * Add a root mixin to a schema
   */
  async addRootMixin(schemaName: string, mixinName: string): Promise<void> {
    await this.request(`/api/schema/${schemaName}/root/${mixinName}`, "PUT");
  }

  /**
   * Remove a root mixin from a schema
   */
  async removeRootMixin(schemaName: string, mixinName: string): Promise<void> {
    await this.request(`/api/schema/${schemaName}/root/${mixinName}`, "DELETE");
  }
}

// Do not use this on the server side! Use react-frontload.
export const ApiContext = createContext<ApiClient>(new ApiClient(""));
