import fetch from "cross-fetch";
import { createContext } from "react";

import {
  Bin,
  CallableRestOperation,
  NextBin,
  Problem,
  Sku,
  SearchResults,
  Batch,
  ApiStatus,
  BinCreationProblem,
  BinCreationResult,
  Status,
  Stats,
  CodeUsageResult,
  AttributeBundle,
  BundleLookupResult,
  BundleContext,
  CaptureResult,
  IntakeRequest,
  IntakeResult,
  InventoryOperationCommand,
  InventoryOperationCorrectionRequest,
  InventoryOperationReceiptListResult,
  InventoryOperationReceiptResult,
  InventoryOperationResult,
  InventoryCandidatesResult,
  AuditObservationRequest,
  AuditObservationResult,
  AuditReconciliationRequest,
  AuditSnapshotResult,
  ProcessDefinition,
  ProcessDefinitionState,
  ProcessDefinitionWrite,
  SkuCreationRequest,
  BatchCreationRequest,
  ResourceCreationResult,
  ResourceCreationProblem,
  RestOperation,
  QuantityCommandResult,
  QuantityHoldingsResult,
  QuantityObservationRequest,
  QuantityWithdrawalRequest,
  decodeRestOperation,
} from "./data-models";
import type {
  AuthProblem,
  ApplicationRootResource,
  AuthSessionResource,
  AuthSessionsResource,
  AuthVerificationResult,
  PasskeyCeremony,
  PasskeyCredentialJSON,
} from "./auth-contracts";

export interface FrontloadContext {
  api: ApiClient;
}

export interface FileUploadState {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  is_image: boolean;
  thumbnail_url?: string;
}

export interface FileUploadResult {
  Id: string;
  state: FileUploadState;
}

/**
 * Inventorius API client
 */
export class ApiClient {
  hostname: string;
  private cookie?: string;
  private csrfToken?: string;

  constructor(hostname = "", options: { cookie?: string } = {}) {
    this.hostname = hostname;
    this.cookie = options.cookie;
  }

  setCsrfToken(token?: string): void {
    this.csrfToken = token;
  }

  hydrateOperation(operation: RestOperation): CallableRestOperation {
    return new CallableRestOperation({
      ...decodeRestOperation(operation),
      hostname: this.hostname,
      transport: this._fetch.bind(this),
    });
  }

  private async _fetch(url: string, options?: RequestInit): Promise<Response> {
    const method = options?.method ?? "GET";
    const headers = new Headers(options?.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);
    if (
      this.csrfToken &&
      !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
    ) {
      headers.set("X-CSRF-Token", this.csrfToken);
    }
    const start = Date.now();
    console.log(`[api] ${method} ${url}`);
    try {
      const resp = await fetch(url, {
        ...options,
        headers,
        credentials: this.hostname ? undefined : "same-origin",
      });
      console.log(
        `[api] ${method} ${url} → ${resp.status} (${Date.now() - start}ms)`,
      );
      return resp;
    } catch (err) {
      console.error(
        `[api] ${method} ${url} → FETCH ERROR (${Date.now() - start}ms)`,
        err,
      );
      throw err;
    }
  }

  hydrate<T extends Sku | Batch | ProcessDefinition>(server_rendered: T): T {
    switch (server_rendered.kind) {
      case "sku":
        return new Sku({
          ...server_rendered,
          hostname: this.hostname,
          transport: this._fetch.bind(this),
        }) as T;
      case "batch":
        return new Batch({
          ...server_rendered,
          hostname: this.hostname,
          transport: this._fetch.bind(this),
        }) as T;
      case "process-definition":
        return new ProcessDefinition({
          ...server_rendered,
          hostname: this.hostname,
          transport: this._fetch.bind(this),
        }) as T;
      default:
        throw new TypeError("Cannot hydrate an unrecognized resource.");
    }
  }

  async getStatus(): Promise<ApiStatus> {
    const resp = await this._fetch(`${this.hostname}/api/status`);
    if (!resp.ok)
      throw Error(`${this.hostname}/api/status returned error code`);
    return new ApiStatus({
      ...(await resp.json()),
      hostname: this.hostname,
      transport: this._fetch.bind(this),
    });
  }

  async getStats(): Promise<Stats> {
    const resp = await this._fetch(`${this.hostname}/api/stats`);
    if (!resp.ok) throw Error(`${this.hostname}/api/stats returned error code`);
    const json = await resp.json();
    return { ...json, kind: "stats" };
  }

  /**
   * Intake either captures an unknown item or receives a deliberately chosen
   * new batch under an existing SKU. Both paths share one idempotent command.
   */
  async intake(
    params: IntakeRequest,
    idempotencyKey: string,
  ): Promise<IntakeResult | Problem> {
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
    if (!resp.ok)
      throw Error(`${this.hostname}/api/next/bin returned error status`);
    return new NextBin({
      ...json,
      // The next-ID response is a read-only hint. Creation is a separate
      // command and is no longer advertised on this response.
      operations: json.operations ?? [],
      hostname: this.hostname,
      transport: this._fetch.bind(this),
    });
  }

  async getSearchResults(params: {
    query: string;
    limit?: string;
    startingFrom?: string;
  }): Promise<SearchResults | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/search?${new URLSearchParams(params).toString()}`,
    );
    const json = await resp.json();

    if (resp.ok) return new SearchResults({ ...json });
    else return { ...json, kind: "problem" };
  }

  async getBin(id: string): Promise<Bin | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/bin/${id}`);
    const json = await resp.json();

    if (resp.ok) {
      return new Bin({
        ...json,
        hostname: this.hostname,
        transport: this._fetch.bind(this),
      });
    } else return { ...json, kind: "problem" };
  }

  async createBin(
    { id, props }: { id?: string; props?: unknown },
    idempotencyKey: string,
  ): Promise<BinCreationResult | BinCreationProblem> {
    const resp = await this._fetch(`${this.hostname}/api/bins`, {
      method: "POST",
      body: JSON.stringify({ id, props }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem", httpStatus: resp.status };
    }
  }

  async getSku(id: string): Promise<Sku | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/sku/${id}`);
    const json = await resp.json();
    if (resp.ok) {
      return new Sku({
        ...json,
        hostname: this.hostname,
        transport: this._fetch.bind(this),
      });
    } else return { ...json, kind: "problem" };
  }

  async createSku(
    params: SkuCreationRequest,
    idempotencyKey: string,
  ): Promise<ResourceCreationResult | ResourceCreationProblem> {
    const resp = await this._fetch(`${this.hostname}/api/skus`, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem", httpStatus: resp.status };
    }
  }

  async getBatch(batch_id: string): Promise<Batch | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/batch/${batch_id}`);
    const json = await resp.json();
    if (resp.ok) {
      return new Batch({
        ...json,
        hostname: this.hostname,
        transport: this._fetch.bind(this),
      });
    } else return { ...json, kind: "problem" };
  }

  async createBatch(
    operation: CallableRestOperation,
    params: BatchCreationRequest,
    idempotencyKey: string,
  ): Promise<ResourceCreationResult | ResourceCreationProblem> {
    const resp = await operation.perform({
      json: params,
      idempotencyKey,
    });
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "status" };
    } else {
      return { ...json, kind: "problem", httpStatus: resp.status };
    }
  }

  async postInventoryOperation(
    command: InventoryOperationCommand,
    idempotencyKey: string,
  ): Promise<InventoryOperationResult | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/inventory-operations`,
      {
        method: "POST",
        body: JSON.stringify(command),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }

  async getAuthSession(): Promise<AuthSessionResource> {
    const response = await this._fetch(`${this.hostname}/api/auth/session`);
    if (!response.ok)
      throw new Error("Unable to read the authentication session.");
    return response.json();
  }

  async getAuthSessions(): Promise<AuthSessionsResource> {
    const response = await this._fetch(`${this.hostname}/api/auth/sessions`);
    if (!response.ok) throw new Error("Unable to read active sessions.");
    return response.json();
  }

  async getApplicationRoot(): Promise<ApplicationRootResource> {
    const response = await this._fetch(`${this.hostname}/api/`);
    if (!response.ok) throw new Error("Unable to read the application root.");
    const resource = (await response.json()) as ApplicationRootResource;
    return {
      ...resource,
      operations: resource.operations.map((operation) =>
        this.hydrateOperation(operation),
      ),
    };
  }

  async startBootstrapRegistration(
    bootstrapToken: string,
  ): Promise<PasskeyCeremony | AuthProblem> {
    const response = await this._fetch(
      `${this.hostname}/api/auth/bootstrap/registration/options`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap_token: bootstrapToken }),
      },
    );
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async startRecoveryRegistration(
    recoveryCode: string,
  ): Promise<PasskeyCeremony | AuthProblem> {
    const response = await this._fetch(
      `${this.hostname}/api/auth/bootstrap/registration/options`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recovery_code: recoveryCode }),
      },
    );
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async startAdditionalPasskeyRegistration(): Promise<
    PasskeyCeremony | AuthProblem
  > {
    const response = await this._fetch(
      `${this.hostname}/api/auth/bootstrap/registration/options`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async finishBootstrapRegistration(
    ceremony: PasskeyCeremony,
    credential: PasskeyCredentialJSON,
  ): Promise<AuthVerificationResult | AuthProblem> {
    const verify = ceremony.operations.find(
      (operation) => operation.rel === "verify",
    );
    if (!verify)
      throw new Error("Registration ceremony has no verification operation.");
    const response = await this._fetch(`${this.hostname}${verify.href}`, {
      method: verify.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ceremony_id: ceremony.state.ceremony_id,
        credential,
      }),
    });
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async startPasskeyAuthentication(): Promise<PasskeyCeremony | AuthProblem> {
    const response = await this._fetch(
      `${this.hostname}/api/auth/passkeys/authentication/options`,
      { method: "POST" },
    );
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async startRecentPasskeyAuthentication(): Promise<
    PasskeyCeremony | AuthProblem
  > {
    const response = await this._fetch(
      `${this.hostname}/api/auth/passkeys/recent-authentication/options`,
      { method: "POST" },
    );
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async logoutAllSessions(): Promise<void> {
    const response = await this._fetch(
      `${this.hostname}/api/auth/logout-all-sessions`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.title || "Unable to sign out every session.");
    }
    this.csrfToken = undefined;
  }

  async localLogin(
    operation: RestOperation,
    token: string,
  ): Promise<AuthVerificationResult | AuthProblem> {
    const response = await this._fetch(`${this.hostname}${operation.href}`, {
      method: operation.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async finishPasskeyAuthentication(
    ceremony: PasskeyCeremony,
    credential: PasskeyCredentialJSON,
  ): Promise<AuthVerificationResult | AuthProblem> {
    const verify = ceremony.operations.find(
      (operation) => operation.rel === "verify",
    );
    if (!verify)
      throw new Error("Authentication ceremony has no verification operation.");
    const response = await this._fetch(`${this.hostname}${verify.href}`, {
      method: verify.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ceremony_id: ceremony.state.ceremony_id,
        credential,
      }),
    });
    const json = await response.json();
    return response.ok ? json : { ...json, kind: "problem" };
  }

  async logout(): Promise<void> {
    const response = await this._fetch(`${this.hostname}/api/auth/logout`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Unable to sign out.");
    this.csrfToken = undefined;
  }

  async getInventoryOperations(
    limit = 8,
  ): Promise<InventoryOperationReceiptListResult | Problem> {
    const params = new URLSearchParams({ limit: String(limit) });
    const resp = await this._fetch(
      `${this.hostname}/api/inventory-operations?${params.toString()}`,
    );
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "inventory-operation-receipt-list" };
    }
    return { ...json, kind: "problem" };
  }

  async getInventoryOperation(
    operationId: string,
  ): Promise<InventoryOperationReceiptResult | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/inventory-operations/${encodeURIComponent(operationId)}`,
    );
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "inventory-operation-receipt" };
    }
    return { ...json, kind: "problem" };
  }

  async correctInventoryOperation(
    operationId: string,
    correction: InventoryOperationCorrectionRequest,
    idempotencyKey: string,
  ): Promise<InventoryOperationReceiptResult | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/inventory-operations/` +
        `${encodeURIComponent(operationId)}/corrections`,
      {
        method: "POST",
        body: JSON.stringify(correction),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "inventory-operation-receipt" };
    }
    return { ...json, kind: "problem" };
  }

  /** Backwards-compatible name for Quick Capture callers. */
  async quickCapture(
    params: Extract<IntakeRequest, { description: string }>,
    idempotencyKey: string,
  ): Promise<CaptureResult | Problem> {
    const response = await this.intake(params, idempotencyKey);
    // The `description` request branch is guaranteed by the intake contract
    // to allocate a SKU, and therefore has the CaptureResult response shape.
    return response.kind === "problem" ? response : (response as CaptureResult);
  }

  async getQuantityHoldings({
    batchId,
    locationId,
  }: {
    batchId?: string;
    locationId?: string;
  }): Promise<QuantityHoldingsResult | Problem> {
    const params = new URLSearchParams();
    if (batchId) params.set("batch_id", batchId);
    if (locationId) params.set("location_id", locationId);
    const response = await this._fetch(
      `${this.hostname}/api/quantity-holdings?${params.toString()}`,
    );
    const json = await response.json();
    if (response.ok) return { ...json, kind: "quantity-holdings" };
    return { ...json, kind: "problem" };
  }

  async postQuantityObservation(
    command: QuantityObservationRequest,
    idempotencyKey: string,
  ): Promise<QuantityCommandResult | Problem> {
    const response = await this._fetch(
      `${this.hostname}/api/quantity-observations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(command),
      },
    );
    const json = await response.json();
    if (response.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }

  async postQuantityWithdrawal(
    command: QuantityWithdrawalRequest,
    idempotencyKey: string,
  ): Promise<QuantityCommandResult | Problem> {
    const response = await this._fetch(
      `${this.hostname}/api/quantity-withdrawals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(command),
      },
    );
    const json = await response.json();
    if (response.ok) return { ...json, kind: "status" };
    return { ...json, kind: "problem" };
  }

  async getInventoryCandidates({
    evidence,
    sourceLocationId,
    signal,
  }: {
    evidence: string[];
    sourceLocationId?: string;
    signal?: AbortSignal;
  }): Promise<InventoryCandidatesResult | Problem> {
    const params = new URLSearchParams();
    for (const value of evidence) params.append("evidence", value);
    if (sourceLocationId) {
      params.set("source_location_id", sourceLocationId);
    }

    const resp = await this._fetch(
      `${this.hostname}/api/inventory-candidates?${params.toString()}`,
      { signal },
    );
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "inventory-candidates" };
    return { ...json, kind: "problem" };
  }

  async getAuditSnapshot(
    locationId: string,
  ): Promise<AuditSnapshotResult | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/audit-snapshots/${encodeURIComponent(locationId)}`,
    );
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "audit-snapshot" };
    return { ...json, kind: "problem" };
  }

  async recordAuditObservation(
    observation: AuditObservationRequest,
    idempotencyKey: string,
  ): Promise<AuditObservationResult | Problem> {
    const resp = await this._fetch(`${this.hostname}/api/audit-observations`, {
      method: "POST",
      body: JSON.stringify(observation),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "audit-observation" };
    return { ...json, kind: "problem" };
  }

  async reconcileAuditObservation(
    observationId: string,
    reconciliation: AuditReconciliationRequest,
    idempotencyKey: string,
  ): Promise<InventoryOperationReceiptResult | Problem> {
    const resp = await this._fetch(
      `${this.hostname}/api/audit-observations/` +
        `${encodeURIComponent(observationId)}/reconciliation`,
      {
        method: "POST",
        body: JSON.stringify(reconciliation),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    const json = await resp.json();
    if (resp.ok) {
      return { ...json, kind: "inventory-operation-receipt" };
    }
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
    context: BundleContext,
  ): Promise<BundleLookupResult> {
    const params = new URLSearchParams({
      field: fieldName,
      q: query,
    });

    if (context.activeBundleIds.length > 0) {
      params.set("active", context.activeBundleIds.join(","));
    }

    const resp = await this._fetch(
      `${this.hostname}/api/schema/${entityType}/search?${params.toString()}`,
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
    context: BundleContext,
  ): Promise<BundleLookupResult> {
    const params = new URLSearchParams({
      field: fieldName,
      value: value,
    });

    if (context.activeBundleIds.length > 0) {
      params.set("active", context.activeBundleIds.join(","));
    }

    const resp = await this._fetch(
      `${this.hostname}/api/schema/${entityType}/search?${params.toString()}`,
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
    query = "",
  ): Promise<ProcessDefinitionState[] | Problem> {
    const params = query ? `?${new URLSearchParams({ query }).toString()}` : "";
    const resp = await this._fetch(
      `${this.hostname}/api/process-definitions${params}`,
    );
    const json = await resp.json();
    if (resp.ok) return json.state;
    return { ...json, kind: "problem" };
  }

  async getProcessDefinition(
    id: string,
    revision?: number,
  ): Promise<ProcessDefinition | Problem> {
    const params = revision
      ? `?${new URLSearchParams({ revision: String(revision) }).toString()}`
      : "";
    const resp = await this._fetch(
      `${this.hostname}/api/process-definition/${id}${params}`,
    );
    const json = await resp.json();
    if (resp.ok) {
      return new ProcessDefinition({
        ...json,
        hostname: this.hostname,
        transport: this._fetch.bind(this),
      });
    }
    return { ...json, kind: "problem" };
  }

  async createProcessDefinition(
    definition: ProcessDefinitionWrite,
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
  async request<T>(
    path: string,
    method: string = "GET",
    body?: unknown,
  ): Promise<T> {
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
      throw new Error(
        (err as { error?: string; message?: string }).error ||
          (err as { message?: string }).message ||
          "Request failed",
      );
    }
    return resp.json();
  }

  /**
   * Upload a schema attachment through the same authenticated transport as
   * every other unsafe request. Do not set Content-Type: the browser supplies
   * the multipart boundary for FormData.
   */
  async uploadFile(file: File): Promise<FileUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const resp = await this._fetch(`${this.hostname}/api/files`, {
      method: "POST",
      body: formData,
    });
    if (!resp.ok) {
      const problem = (await resp.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
        "invalid-params"?: Array<{ reason?: string }>;
      };
      throw new Error(
        problem["invalid-params"]?.[0]?.reason ||
          problem.detail ||
          problem.title ||
          "Upload failed",
      );
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
    fieldValues: Record<string, string | boolean>,
  ): Promise<{ active_mixins: string[]; available_fields: unknown[] }> {
    return this.request(`/api/schema/${schemaName}/evaluate`, "POST", {
      active_mixins: activeMixins,
      field_values: fieldValues,
    });
  }

  /**
   * Save a mixin in a schema
   */
  async saveMixin(
    schemaName: string,
    mixinName: string,
    mixin: unknown,
  ): Promise<void> {
    await this.request(
      `/api/schema/${schemaName}/mixin/${mixinName}`,
      "PUT",
      mixin,
    );
  }

  /**
   * Delete a mixin from a schema
   */
  async deleteMixin(schemaName: string, mixinName: string): Promise<void> {
    await this.request(
      `/api/schema/${schemaName}/mixin/${mixinName}`,
      "DELETE",
    );
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
