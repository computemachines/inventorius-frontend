import * as React from "react";
import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { useFrontload } from "react-frontload";
import { useNavigate, useLocation } from "react-router-dom";
import { parse } from "query-string";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { CodeUsageRef } from "../api-client/data-models";
import { ToastContext } from "./Toast";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";

/**
 * Code entry during scanning phase
 */
interface ScannedCode {
  id: string;
  value: string;
  matches: CodeUsageRef[];
  isLoading: boolean;
}

/**
 * Match result after analyzing all scanned codes
 */
type MatchResult =
  | { status: "scanning" }
  | { status: "identified"; sku: CodeUsageRef; unknownCodes: string[] }
  | { status: "multiple"; candidates: CodeUsageRef[] }
  | { status: "none"; codes: string[] };

/**
 * Dynamic batch definition page.
 *
 * Workflow:
 * 1. Scan codes from package
 * 2. System matches codes to SKUs
 * 3. Create batch under identified/selected SKU
 */
export function DefineBatch() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParentSkuId = (parse(location.search).parent as string) || "";

  const { data, frontloadMeta, setData } = useFrontload(
    "define-batch-component",
    async ({ api }: FrontloadContext) => ({
      nextBatch: await api.getNextBatch(),
      parentSku: queryParentSkuId ? await api.getSku(queryParentSkuId) : null,
    })
  );

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  // Scanning phase state
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([
    { id: crypto.randomUUID(), value: "", matches: [], isLoading: false }
  ]);
  const [matchResult, setMatchResult] = useState<MatchResult>({ status: "scanning" });

  // Batch definition state
  const [selectedSku, setSelectedSku] = useState<CodeUsageRef | null>(null);
  const [batchId, setBatchId] = useState("");
  const [batchName, setBatchName] = useState("");
  const [uniquelyIdentifies, setUniquelyIdentifies] = useState(true);

  // Refs
  const codeInputRef = useRef<HTMLInputElement>(null);
  const debounceRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Set parent SKU from query param
  useEffect(() => {
    if (data?.parentSku?.kind === "sku") {
      setSelectedSku({
        type: "sku",
        id: data.parentSku.state.id,
        name: data.parentSku.state.name,
        relationship: "owned",
      });
      setMatchResult({
        status: "identified",
        sku: {
          type: "sku",
          id: data.parentSku.state.id,
          name: data.parentSku.state.name,
          relationship: "owned",
        },
        unknownCodes: [],
      });
    }
  }, [data?.parentSku]);

  const batchIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextBatch.state || "BAT000001";

  /**
   * Look up code usage and update matches
   */
  const lookupCode = useCallback(async (codeId: string, value: string) => {
    if (!value.trim()) {
      setScannedCodes(prev => prev.map(c =>
        c.id === codeId ? { ...c, matches: [], isLoading: false } : c
      ));
      return;
    }

    setScannedCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, isLoading: true } : c
    ));

    const result = await api.getCodeUsage(value.trim());

    setScannedCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, matches: result.usedBy, isLoading: false } : c
    ));
  }, [api]);

  /**
   * Handle code input change with debounced lookup
   */
  const handleCodeChange = (codeId: string, newValue: string) => {
    setScannedCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, value: newValue } : c
    ));

    const existing = debounceRefs.current.get(codeId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      lookupCode(codeId, newValue);
      debounceRefs.current.delete(codeId);
    }, 300);
    debounceRefs.current.set(codeId, timeout);
  };

  /**
   * Handle Tab in last code input - add new row
   */
  const handleCodeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Tab" && !e.shiftKey && index === scannedCodes.length - 1) {
      const lastCode = scannedCodes[index];
      if (lastCode.value.trim()) {
        e.preventDefault();
        setScannedCodes(prev => [
          ...prev,
          { id: crypto.randomUUID(), value: "", matches: [], isLoading: false }
        ]);
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>('input[data-code-input]');
          inputs[inputs.length - 1]?.focus();
        }, 0);
      }
    }
  };

  /**
   * Analyze all scanned codes and compute match result
   */
  const analyzeMatches = useCallback(() => {
    const nonEmptyCodes = scannedCodes.filter(c => c.value.trim());
    if (nonEmptyCodes.length === 0) {
      setMatchResult({ status: "scanning" });
      return;
    }

    const skuMatches = new Map<string, CodeUsageRef>();
    const unknownCodes: string[] = [];

    for (const code of nonEmptyCodes) {
      if (code.matches.length === 0) {
        unknownCodes.push(code.value);
      } else {
        for (const match of code.matches) {
          if (match.type === "sku") {
            skuMatches.set(match.id, match);
          }
        }
      }
    }

    if (skuMatches.size === 0) {
      setMatchResult({ status: "none", codes: nonEmptyCodes.map(c => c.value) });
    } else if (skuMatches.size === 1) {
      const sku = Array.from(skuMatches.values())[0];
      setMatchResult({ status: "identified", sku, unknownCodes });
      setSelectedSku(sku);
    } else {
      setMatchResult({ status: "multiple", candidates: Array.from(skuMatches.values()) });
    }
  }, [scannedCodes]);

  useEffect(() => {
    const anyLoading = scannedCodes.some(c => c.isLoading);
    if (!anyLoading) {
      analyzeMatches();
    }
  }, [scannedCodes, analyzeMatches]);

  const handleSelectSku = (sku: CodeUsageRef) => {
    setSelectedSku(sku);
    const unknownCodes = scannedCodes
      .filter(c => c.value.trim() && c.matches.length === 0)
      .map(c => c.value);
    setMatchResult({ status: "identified", sku, unknownCodes });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const unknownCodes = scannedCodes
      .filter(c => c.value.trim() && c.matches.length === 0)
      .map(c => c.value);

    const ownedCodes = uniquelyIdentifies ? unknownCodes : [];
    const associatedCodes = uniquelyIdentifies ? [] : unknownCodes;

    const resp = await api.createBatch({
      id: batchId || batchIdPlaceholder,
      sku_id: selectedSku?.id || null,
      name: batchName || undefined,
      owned_codes: ownedCodes,
      associated_codes: associatedCodes,
    });

    if (resp.kind === "status") {
      setToastContent({
        content: (
          <p>
            Success,{" "}
            <ItemLabel url={resp.Id} onClick={() => setToastContent({})} />{" "}
            created.
          </p>
        ),
        mode: "success",
      });
      setScannedCodes([{ id: crypto.randomUUID(), value: "", matches: [], isLoading: false }]);
      setMatchResult({ status: "scanning" });
      setSelectedSku(null);
      setBatchId("");
      setBatchName("");
      const nextBatch = await api.getNextBatch();
      setData(prev => ({ ...prev, nextBatch }));
      codeInputRef.current?.focus();
    } else {
      setToastContent({
        content: <p>{resp.title}</p>,
        mode: "failure",
      });
    }
  };

  if (frontloadMeta.pending) return <div className="p-4">Loading...</div>;
  if (frontloadMeta.error) throw Error("API Error");

  const unknownCodes = scannedCodes
    .filter(c => c.value.trim() && c.matches.length === 0)
    .map(c => c.value);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">Define Batch</h2>

      {/* Phase 1: Code Scanning */}
      <section className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium mb-1">Scan Codes</h3>
        <p className="text-sm text-gray-600 mb-4">
          Scan codes from the package to identify the SKU
        </p>

        <div className="flex flex-col gap-2">
          {scannedCodes.map((code, index) => (
            <div key={code.id} className="flex items-center gap-2">
              <input
                ref={index === 0 ? codeInputRef : undefined}
                data-code-input
                type="text"
                className="flex-1 px-3 py-2 font-mono text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Scan or type code..."
                value={code.value}
                onChange={(e) => handleCodeChange(code.id, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(e, index)}
              />
              {code.isLoading && <span className="text-sm">⏳</span>}
              {!code.isLoading && code.value && (
                <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                  code.matches.length > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {code.matches.length > 0 ? `✓ ${code.matches.length} match` : '? new'}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Phase 2: Match Results */}
      <section className="mb-6">
        {matchResult.status === "scanning" && (
          <div className="p-4 bg-gray-100 rounded-lg text-gray-600 text-center">
            Scan codes to identify SKU...
          </div>
        )}

        {matchResult.status === "identified" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="font-medium text-green-800 mb-2">✓ Identified</div>
            <div className="flex items-center gap-3 p-2 bg-white rounded mb-2">
              <ItemLabel label={matchResult.sku.id} />
              <span className="text-gray-600">{matchResult.sku.name}</span>
            </div>
            {matchResult.unknownCodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-green-200">
                <span className="text-sm text-gray-600">New codes:</span>
                {matchResult.unknownCodes.map(c => (
                  <code key={c} className="text-sm px-2 py-1 bg-white rounded font-mono">{c}</code>
                ))}
              </div>
            )}
          </div>
        )}

        {matchResult.status === "multiple" && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="font-medium text-yellow-800 mb-2">Multiple matches - select one:</div>
            <div className="flex flex-col gap-2">
              {matchResult.candidates.map(candidate => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`flex items-center gap-3 p-3 bg-white rounded-lg border-2 text-left transition-colors ${
                    selectedSku?.id === candidate.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent hover:border-blue-300'
                  }`}
                  onClick={() => handleSelectSku(candidate)}
                >
                  <span className="font-mono font-semibold text-blue-600">{candidate.id}</span>
                  <span className="text-gray-600">{candidate.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {matchResult.status === "none" && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="font-medium text-red-800 mb-2">No matches</div>
            <p className="text-sm text-gray-700 mb-3">Scanned codes don't match any existing SKU.</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                onClick={() => navigate("/new/sku")}
              >
                Create New SKU
              </button>
              <span className="text-sm text-gray-500">or continue without SKU</span>
            </div>
          </div>
        )}
      </section>

      {/* Phase 3: Batch Definition */}
      {(matchResult.status === "identified" || matchResult.status === "none") && (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium mb-4">Batch Details</h3>

          <label htmlFor="batch_id" className="block text-sm font-medium text-gray-700 mb-1">
            Batch Label
          </label>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              id="batch_id"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={batchIdPlaceholder}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <PrintButton value={batchId || batchIdPlaceholder} />
          </div>

          <label htmlFor="batch_name" className="block text-sm font-medium text-gray-700 mb-1">
            Name (optional)
          </label>
          <input
            type="text"
            id="batch_name"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            placeholder={selectedSku?.name || ""}
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
          />

          {unknownCodes.length > 0 && (
            <div className="p-3 bg-white rounded border border-gray-200 mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Codes to add to batch</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {unknownCodes.map(code => (
                  <code key={code} className="text-sm px-2 py-1 bg-gray-100 rounded font-mono">{code}</code>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={uniquelyIdentifies}
                  onChange={(e) => setUniquelyIdentifies(e.target.checked)}
                />
                <span>These codes uniquely identify this batch</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Create Batch
          </button>
        </form>
      )}
    </div>
  );
}

export default DefineBatch;
