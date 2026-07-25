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

  // DELETE endpoints correctly return 204 with no response body. Do not ask
  // the Fetch API to parse absent JSON as though the operation had failed.
  if (resp.ok && resp.status === 204) {
    return { kind: "status", status: "operation completed" };
  }

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
  detail?: string;
  blocker?: string;
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
  Id?: string;
  /**
   * Human readable status string.
   */
  status: string;
}

export interface BinCreationResult extends Status {
  state: {
    id: string;
    props: Props;
  };
}

export interface BinCreationProblem extends Problem {
  /** Preserve the transport status so callers can distinguish rejection from uncertainty. */
  httpStatus: number;
}

export interface ResourceCreationResult extends Status {
  /**
   * Canonical persisted identity returned by the server.
   *
   * Creation forms deliberately use this value, rather than an identifier
   * prediction, as the only printable identity.
   */
  state: {
    id: string;
    [key: string]: unknown;
  };
}

export interface ResourceCreationProblem extends Problem {
  /** Preserve the transport status so callers can distinguish rejection from uncertainty. */
  httpStatus: number;
}

export interface SkuCreationRequest {
  id?: string;
  name: string;
  props?: unknown;
  owned_codes?: string[];
  associated_codes?: string[];
}

export interface BatchCreationRequest {
  id?: string;
  sku_id?: string;
  name?: string;
  owned_codes?: string[];
  associated_codes?: string[];
  props?: unknown;
}

interface IntakeState {
  sku_id: string;
  batch_id: string;
  operation_id: string;
  bin_id: string;
  quantity: number;
  unit: "each";
  observed_codes: string[];
  provisional: true;
}

/** The Quick Capture branch allocated a provisional SKU from its description. */
export interface CaptureResult extends Status {
  state: IntakeState & {
    description: string;
    created_sku: true;
  };
}

/** The Receive branch created a new batch under an explicitly selected SKU. */
export interface ExistingSkuIntakeResult extends Status {
  state: IntakeState & {
    created_sku: false;
  };
}

export type IntakeResult = CaptureResult | ExistingSkuIntakeResult;

export type IntakeRequest =
  | {
      description: string;
      bin_id: string;
      quantity: number;
      unit: "each";
      observed_codes?: string[];
    }
  | {
      sku_id: string;
      bin_id: string;
      quantity: number;
      unit: "each";
      observed_codes?: string[];
    };

/**
 * A constrained inventory command submitted by a scanner-facing workflow.
 *
 * The API deliberately accepts domain commands rather than arbitrary ledger
 * legs. The location terminology leaves room for racks, workstations, and
 * other future locations while the current UI still calls them bins.
 */
export type InventoryOperationCommand =
  | {
      kind: "receive";
      batch_id: string;
      quantity: number;
      unit: "each";
      location_id: string;
      observed_codes?: string[];
    }
  | {
      kind: "release";
      batch_id: string;
      quantity: number;
      unit: "each";
      location_id: string;
    }
  | {
      kind: "transfer";
      batch_id: string;
      quantity: number;
      unit: "each";
      source_location_id: string;
      destination_location_id: string;
    };

export interface InventoryOperationResult extends Status {
  state: {
    operation_id: string;
    kind: InventoryOperationCommand["kind"];
    batch_id: string;
    quantity: number;
    unit: "each";
    packaging_configuration_id: string | null;
    location_id?: string;
    source_location_id?: string;
    destination_location_id?: string;
    observed_codes?: string[];
  };
}

export type InventoryReceiptQuantity = number | string | null;

export interface InventoryOperationReceiptLeg {
  batch_id: string;
  location_id: string;
  unit: string;
  packaging_configuration_id: string | null;
  quantity: InventoryReceiptQuantity;
}

export interface InventoryOperationReceiptHolding {
  batch_id: string;
  location_id: string;
  unit: string;
  packaging_configuration_id: string | null;
  quantity: InventoryReceiptQuantity;
}

export interface InventoryOperationReceiptBatch {
  batch_id: string;
  batch_name: string | null;
  sku_id: string | null;
  sku_name: string | null;
}

/**
 * The intentionally small, public subset of the command result retained with
 * a receipt. Intake adds SKU/description fields; ordinary Receive does not.
 */
export interface InventoryOperationReceiptCommandResult {
  operation_id?: string;
  kind?: string;
  batch_id?: string;
  sku_id?: string;
  location_id?: string;
  bin_id?: string;
  source_location_id?: string;
  destination_location_id?: string;
  quantity?: InventoryReceiptQuantity;
  unit?: string;
  packaging_configuration_id?: string | null;
  observed_codes?: string[];
  created_sku?: boolean;
  provisional?: boolean;
  description?: string;
  mode?: string;
  corrects_operation_id?: string;
  observation_id?: string;
  snapshot_token?: string;
  reason?: string;
  note?: string;
  boundary?: string;
  original_state?: InventoryOperationReceiptState;
  intended_state?: InventoryOperationReceiptState;
}

export interface InventoryOperationReceiptState {
  batch_id?: string;
  location_id?: string;
  unit?: string;
  packaging_configuration_id?: string | null;
  quantity?: InventoryReceiptQuantity;
}

export interface InventoryOperationReceipt {
  operation_id: string;
  kind: string;
  created_at: string | null;
  legs: InventoryOperationReceiptLeg[];
  result: InventoryOperationReceiptCommandResult;
  batches: InventoryOperationReceiptBatch[];
  current_holdings: InventoryOperationReceiptHolding[];
  corrects_operation_id: string | null;
  reconciles_observation_id: string | null;
  corrected_by_operation_id: string | null;
  correction: {
    correctable: boolean;
    blocker: string | null;
  };
}

export interface InventoryOperationReceiptResult {
  kind: "inventory-operation-receipt";
  status?: string;
  state: InventoryOperationReceipt;
}

export interface InventoryOperationReceiptListResult {
  kind: "inventory-operation-receipt-list";
  state: {
    operations: InventoryOperationReceipt[];
  };
}

export interface InventoryOperationCorrectionRequest {
  quantity: number;
  location_id: string;
}

export interface InventoryCandidateMatch {
  evidence: string;
  kind: "batch-id" | "sku-id" | "code" | "text";
  scope: "batch" | "sku";
  relationship: "identity" | "owned" | "associated" | "observed" | "name";
  resource_id: string;
  value: string;
}

export interface InventoryCandidate {
  batch_id: string;
  sku_id: string | null;
  batch_name: string | null;
  sku_name: string | null;
  available_quantity: number | string | null;
  unit: "each";
  packaging_configuration_id: null;
  matches: InventoryCandidateMatch[];
}

export interface InventoryOwnedCodeConflict {
  evidence: string;
  kind: "duplicate-owned-code";
  claimants: Array<{
    scope: "batch" | "sku";
    resource_id: string;
    name: string | null;
  }>;
}

export interface InventoryEvidenceConflict {
  kind: "evidence-conflict";
  evidence: string[];
  candidate_sets: Array<{
    evidence: string;
    total_num_candidates: number;
    batch_ids: string[];
  }>;
}

export type InventoryCandidateConflict =
  | InventoryOwnedCodeConflict
  | InventoryEvidenceConflict;

export interface InventoryCandidateContextMismatch {
  batch_id: string;
  sku_id: string | null;
  batch_name: string | null;
  sku_name: string | null;
  reason: "not-at-location" | "unsupported-holding-shape";
}

export interface InventorySkuCandidate {
  sku_id: string;
  sku_name: string | null;
  matches: InventoryCandidateMatch[];
}

export interface InventorySkuEvidenceConflict {
  kind: "sku-evidence-conflict";
  evidence: string[];
  candidate_sets: Array<{
    evidence: string;
    total_num_candidates: number;
    sku_ids: string[];
  }>;
}

export interface InventorySkuCandidatesState {
  status: "unknown" | "identified" | "candidates" | "conflict";
  resolution: "none" | "unique" | "ambiguous";
  total_num_results: number;
  limit: number;
  starting_from: number;
  returned_num_results: number;
  truncated: boolean;
  results: InventorySkuCandidate[];
  conflicts: Array<InventorySkuEvidenceConflict | InventoryOwnedCodeConflict>;
  /** Resolver input that did not identify a SKU directly; it is not durable observation evidence. */
  unmatched_evidence: string[];
}

/**
 * Contextual inventory identity resolution.
 *
 * `identified` is the only state safe to auto-select. A single text candidate
 * still uses `candidates`, because cardinality alone is not proof of identity.
 */
export interface InventoryCandidatesResult {
  kind: "inventory-candidates";
  state: {
    evidence: string[];
    source_location_id: string | null;
    status: "unknown" | "identified" | "candidates" | "conflict";
    resolution: "none" | "unique" | "ambiguous";
    total_num_results: number;
    limit: number;
    starting_from: number;
    returned_num_results: number;
    truncated: boolean;
    results: InventoryCandidate[];
    conflicts: InventoryCandidateConflict[];
    /** Context-free SKU resolution for explicitly creating a new batch. */
    sku_candidates: InventorySkuCandidatesState;
    total_context_mismatches: number;
    context_mismatches: InventoryCandidateContextMismatch[];
  };
}

export interface AuditSnapshotHolding {
  batch_id: string;
  sku_id: string | null;
  batch_name: string | null;
  sku_name: string | null;
  quantity: number | string;
  unit: string;
  packaging_configuration_id: string | null;
  supported: boolean;
}

export type AuditSnapshotBlocker =
  | {
      type: "legacy-bin-contents";
      entry_count: number;
    }
  | {
      type: "unsupported-holding-shapes";
      holding_count: number;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export interface AuditSnapshotResult {
  kind: "audit-snapshot";
  state: {
    location_id: string;
    snapshot_token: string;
    holdings: AuditSnapshotHolding[];
    blockers: AuditSnapshotBlocker[];
  };
}

export interface AuditObservationCount {
  batch_id: string;
  quantity: number;
  unit: "each";
  packaging_configuration_id: null;
}

export interface AuditObservationRequest {
  location_id: string;
  snapshot_token: string;
  counts: AuditObservationCount[];
  unresolved_evidence?: string[];
}

export interface AuditObservationRecordedCount {
  batch_id: string;
  unit: "each";
  packaging_configuration_id: null;
  recorded_quantity: number | string;
  observed_quantity: number | string;
  difference: number | string;
}

export interface AuditObservationState {
  observation_id: string;
  location_id: string;
  snapshot_token: string;
  recorded_at: string;
  counts: AuditObservationRecordedCount[];
  unresolved_evidence: string[];
  reconciled_by_operation_id?: string;
}

export interface AuditObservationResult {
  kind: "audit-observation";
  status?: string;
  state: AuditObservationState;
}

export interface AuditReconciliationRequest {
  reason: "unexplained-variance";
  note?: string;
}

class RestEndpoint {
  state: unknown;
  operations: Record<string, CallableRestOperation>;
  constructor({
    state,
    operations,
    hostname,
    transport,
  }: {
    state: unknown;
    operations: RestOperation[];
    hostname: string;
    transport?: OperationTransport;
  }) {
    this.state = state;
    this.operations = {};
    for (const op of operations) {
      this.operations[op.rel] = new CallableRestOperation({
        hostname,
        transport,
        ...op,
      });
    }
  }
}

export interface RestOperation {
  rel: string;
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export type OperationTransport = (
  url: string,
  options?: RequestInit
) => Promise<Response>;

export class CallableRestOperation implements RestOperation {
  rel: string;
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  hostname: string;
  private transport?: OperationTransport;
  constructor(config: {
    rel: string;
    href: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    hostname: string;
    transport?: OperationTransport;
  }) {
    const { transport, ...wireConfig } = config;
    Object.assign(this, wireConfig);
    this.bindTransport(transport);
  }

  bindTransport(transport?: OperationTransport): void {
    Object.defineProperty(this, "transport", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: transport,
    });
  }

  perform({
    body,
    json,
  }: {
    body?: string;
    json?: unknown;
  } = {}): Promise<Response> {
    const request = this.transport ?? fetch;
    if (body) {
      return request(`${this.hostname}${this.href}`, {
        method: this.method,
        body,
      });
    } else if (json) {
      return request(`${this.hostname}${this.href}`, {
        method: this.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(json),
      });
    } else {
      return request(`${this.hostname}${this.href}`, {
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
    delete?: CallableRestOperation;
    update?: CallableRestOperation;
  };

  update(patch: { props: Props }): Promise<Status | Problem> {
    if (!this.operations.update) throw new Error("Update is not permitted.");
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }

  delete(): Promise<Status | Problem> {
    if (!this.operations.delete) throw new Error("Delete is not permitted.");
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
    update?: CallableRestOperation;
    delete?: CallableRestOperation;
    bins: CallableRestOperation;
    batches: CallableRestOperation;
  };
  update(patch: {
    name?: string;
    owned_codes?: string[];
    associated_codes?: string[];
    props?: Props;
  }): Promise<Status | Problem> {
    if (!this.operations.update) throw new Error("Update is not permitted.");
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }
  delete(): Promise<Status | Problem> {
    if (!this.operations.delete) throw new Error("Delete is not permitted.");
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
    update?: CallableRestOperation;
    delete?: CallableRestOperation;
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
    if (!this.operations.update) throw new Error("Update is not permitted.");
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }
  delete(): Promise<Status | Problem> {
    if (!this.operations.delete) throw new Error("Delete is not permitted.");
    return status_or_problem(this.operations.delete.perform());
  }
  async bins(): Promise<BatchLocations | Problem> {
    const resp = await this.operations.bins.perform();
    const json = await resp.json();
    if (resp.ok) return { ...json, kind: "batch-locations" };
    else return { ...json, kind: "problem" };
  }
}

export type ProcessDefinitionKind =
  | "repackaging"
  | "assembly"
  | "disassembly"
  | "transformation"
  | "blending";

export interface ProcessRequirement {
  role: string;
  sku_id?: string;
  quantity?: number;
  unit: string;
}

export interface ProcessDefinitionWrite {
  name: string;
  kind: ProcessDefinitionKind;
  description?: string;
  inputs: ProcessRequirement[];
  outputs: ProcessRequirement[];
  instructions?: string[];
}

export interface ProcessDefinitionState extends ProcessDefinitionWrite {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  is_current: boolean;
}

export class ProcessDefinition extends RestEndpoint {
  kind: "process-definition" = "process-definition";
  state: ProcessDefinitionState;
  operations: {
    update?: CallableRestOperation;
    delete?: CallableRestOperation;
    revisions: CallableRestOperation;
  };

  update(patch: Partial<ProcessDefinitionWrite>): Promise<Status | Problem> {
    if (!this.operations.update) {
      return Promise.resolve({
        kind: "problem",
        type: "historical-revision",
        title: "Historical process revisions cannot be edited.",
      });
    }
    if (!this.operations.update) throw new Error("Update is not permitted.");
    return status_or_problem(this.operations.update.perform({ json: patch }));
  }

  delete(): Promise<Status | Problem> {
    if (!this.operations.delete) {
      return Promise.resolve({
        kind: "problem",
        type: "historical-revision",
        title: "Historical process revisions cannot be deleted.",
      });
    }
    if (!this.operations.delete) throw new Error("Delete is not permitted.");
    return status_or_problem(this.operations.delete.perform());
  }

  async revisions(): Promise<ProcessDefinitionState[] | Problem> {
    const response = await this.operations.revisions.perform();
    const json = await response.json();
    if (response.ok) return json.state;
    return { ...json, kind: "problem" };
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

export type SearchResult = SkuState | BatchState | BinState;

/**
 * Evidence explaining why a returned resource was included in a search.
 *
 * Search resources deliberately retain their ordinary API shapes. This
 * parallel projection keeps result-specific search evidence out of SKU, Batch,
 * and Bin state while allowing the UI to say why a scanner or keyword matched.
 */
export interface SearchMatchReason {
  kind:
    | "exact-code"
    | "internal-label"
    | "identifier-fragment"
    | "name-fragment"
    | "code-fragment"
    | "debug";
  value: string;
  scope: "sku" | "batch" | "bin";
  relationship?: "owned" | "associated" | "observed";
}

/** One positive canonical ledger holding shown with a search result. */
export interface SearchResultLocation {
  location_id: string;
  batch_id: string;
  quantity: number | string;
  unit: string | null;
  packaging_configuration_id: string | null;
}

export interface SearchResultDetail {
  matched_by: SearchMatchReason[];
  locations: SearchResultLocation[];
}

export class SearchResults extends RestEndpoint {
  kind: "search-results" = "search-results";
  state: {
    total_num_results: number;
    starting_from: number;
    limit: number;
    returned_num_results: number;
    results: SearchResult[];
    /** Page-local details keyed by canonical resource identity. */
    details?: Record<string, SearchResultDetail>;
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
// Unified Trigger Field Model
// =============================================================================

/**
 * An AttributeBundle is a named collection of fields that can be activated.
 * This unifies the concepts of "Category" and "Mixin" into a single model.
 *
 * Examples:
 * - SKU "Resistor" bundle: activated by typing "Resistor" in Item Type field
 * - SKU "SMD" bundle: activated by selecting "0402" in Package field
 * - Batch "DigiKey" bundle: activated by typing "DigiKey" in Source field
 */
export interface AttributeBundle {
  id: string;
  name: string;
  /** Fields contributed by this bundle */
  fields: SchemaField[];
}

/**
 * How a trigger field activates bundles
 */
export type TriggerMatchType = "typeahead" | "exact";

/**
 * A field that, when filled, can activate additional bundles/fields.
 * Extends SchemaField with trigger capabilities.
 */
export interface TriggerFieldDef {
  name: string;
  label: string;
  /** How to match: typeahead (prefix search) or exact (value match) */
  matchType: TriggerMatchType;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * Result from a bundle lookup (unified replacement for CategorySearchResult and MixinSearchResult)
 */
export interface BundleLookupResult {
  kind: "bundle-lookup-result";
  /** Matched bundles */
  bundles: AttributeBundle[];
  /** Intersection fields from active bundle combinations */
  intersectionFields: SchemaField[];
}

/**
 * Context for bundle lookups - tracks which bundles are currently active
 * so we can compute intersections
 */
export interface BundleContext {
  /** Entity type: "sku" or "batch" */
  entityType: "sku" | "batch";
  /** Currently active bundle IDs */
  activeBundleIds: string[];
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
