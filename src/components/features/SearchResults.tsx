// src/components/features/SearchResults.tsx
// Fully human reviewed: YES
// Fully human written: YES
// Progress: NONE
//
// Conversation:
// > Should this use react-router? Is react-router still the best choice here?
//   What about how I use ssr? When responding cite other files.

import * as React from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useFrontload } from "react-frontload";
import { ApiContext, FrontloadContext } from "../../api-client/api-client";
import {
  isBatchState,
  isBinState,
  isSkuState,
  SearchMatchReason,
  SearchResult,
  SearchResultDetail,
  SearchResultLocation,
  SearchResults as APISearchResults,
} from "../../api-client/data-models";

import { stringifyUrl } from "query-string";
import { Pager } from "../primitives/Pager";
import ItemLabel from "../primitives/ItemLabel";

function resultToType(result: SearchResult): "SKU" | "BATCH" | "BIN" {
  if (isBinState(result)) return "BIN";
  if (isSkuState(result)) return "SKU";
  if (isBatchState(result)) return "BATCH";
}

function matchReasonLabel(reason: SearchMatchReason): string {
  switch (reason.kind) {
  case "exact-code":
    if (reason.relationship === "observed") {
      return "Exact observed code";
    }
    return "Exact saved code";
  case "internal-label":
    return "Internal label";
  case "identifier-fragment":
    return "Identifier";
  case "name-fragment":
    return "Name";
  case "code-fragment":
    if (reason.relationship === "observed") {
      return "Observed code";
    }
    return "Saved code";
  case "debug":
    return "Debug query";
  }
}

function MatchEvidence({ reasons }: { reasons: SearchMatchReason[] }) {
  if (!reasons.length) {
    return <span className="text-slate-500">Match details unavailable</span>;
  }

  const labels = Array.from(new Set(reasons.map(matchReasonLabel)));

  return (
    <span className="text-sm text-slate-600">
      Matched by <span className="font-medium">{labels.join(", ")}</span>
    </span>
  );
}

function HoldingLocation({
  location,
  showBatch,
}: {
  location: SearchResultLocation;
  showBatch: boolean;
}) {
  return (
    <li className="leading-5">
      <ItemLabel label={location.location_id} />
      {" · "}
      <span>
        {location.quantity}
        {location.unit ? ` ${location.unit}` : " (unit unrecorded)"}
      </span>
      {showBatch && (
        <>
          {" · "}
          <ItemLabel label={location.batch_id} />
        </>
      )}
      {location.packaging_configuration_id && (
        <>
          {" · package "}
          <span className="break-all">
            {location.packaging_configuration_id}
          </span>
        </>
      )}
    </li>
  );
}

function PositiveLocations({
  locations,
  resourceId,
}: {
  locations: SearchResultLocation[];
  resourceId: string;
}) {
  if (!locations.length) {
    return (
      <span className="text-sm text-slate-500">
        Not recorded in the current ledger
      </span>
    );
  }

  return (
    <ul className="m-0 list-none p-0 text-sm text-slate-700">
      {locations.map((location, index) => (
        <HoldingLocation
          key={`${location.location_id}-${location.batch_id}-${location.unit}-${location.packaging_configuration_id || ""}-${index}`}
          location={location}
          showBatch={location.batch_id !== resourceId}
        />
      ))}
    </ul>
  );
}

function SearchResultItem({
  result,
  onClickLink,
}: {
  result: SearchResult;
  onClickLink?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <ItemLabel label={result.id} onClick={onClickLink} />
      <span
        className="text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        {resultToType(result)}
      </span>
    </span>
  );
}

function SearchResultsList({
  searchResults,
  loading,
  onClickLink,
}: {
  searchResults: APISearchResults;
  loading?: boolean;
  onClickLink?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <ul
      className={`m-0 list-none divide-y divide-slate-200 overflow-hidden
        rounded-md bg-white p-0 shadow ${loading ? "opacity-50" : ""}`}
    >
      {searchResults.state.results.map((result) => {
        const detail: SearchResultDetail = searchResults.state.details?.[
          result.id
        ] || {
          matched_by: [],
          locations: [],
        };
        const resultHeadingId = `search-result-${result.id}`;

        return (
          <li key={result.id}>
            <article
              aria-labelledby={resultHeadingId}
              className="grid gap-3 p-3
                sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]"
            >
              <div className="min-w-0">
                <h3
                  id={resultHeadingId}
                  className="m-0 text-base font-semibold"
                >
                  <SearchResultItem result={result} onClickLink={onClickLink} />
                </h3>
                {!isBinState(result) && (
                  <p className="mt-1 break-words text-slate-800">
                    {result.name || (
                      <span className="italic">Unnamed item</span>
                    )}
                  </p>
                )}
                <p className="mt-1">
                  <MatchEvidence reasons={detail.matched_by} />
                </p>
              </div>

              <div
                className="min-w-0 border-t border-slate-100 pt-2 sm:border-l
                  sm:border-t-0 sm:pl-3 sm:pt-0"
              >
                {isBinState(result) ? (
                  <span className="text-sm text-slate-500">
                    Location record
                  </span>
                ) : (
                  <>
                    <h4
                      className="mb-1 text-xs font-semibold uppercase
                        tracking-wide text-slate-500"
                    >
                      Available at
                    </h4>
                    <PositiveLocations
                      locations={detail.locations}
                      resourceId={result.id}
                    />
                  </>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function SearchResults({
  query,
  page = 1,
  limit = 20,
}: {
  query: string;
  page?: number;
  limit?: number;
}) {
  const startingFrom = (page - 1) * limit;
  const { data, frontloadMeta, setData } = useFrontload(
    "searchresults-component",
    async ({ api }: FrontloadContext) => {
      return {
        searchResults: await api.getSearchResults({
          query,
          startingFrom: startingFrom.toString(),
          limit: limit.toString(),
        }),
      };
    },
  );

  const api = React.useContext(ApiContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = React.useState(false);

  // Update search results when query changes.
  // Do not update if not resolving most recent promise.
  // TODO: Change to AbortController
  useEffect(() => {
    if (!frontloadMeta.done) return;

    let isCancelled = false;
    setIsLoading(true);
    api
      .getSearchResults({
        query,
        startingFrom: startingFrom.toString(),
        limit: limit.toString(),
      })
      .then((newSearchResults) => {
        if (!isCancelled) {
          setData(() => ({ searchResults: newSearchResults }));
          setIsLoading(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [query, startingFrom, limit]);

  const searchUrl = stringifyUrl({
    url: "/search",
    query: page == 1 ? { query: query.trim() } : { query: query.trim(), page },
  });
  const currentUrl = location.pathname + location.search;

  // Keep typing transient. If a query remains useful for ten seconds, commit
  // it to history so reload, sharing, and Back navigation reproduce it.
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || currentUrl == searchUrl) return;

    const timer = window.setTimeout(() => navigate(searchUrl), 10_000);
    return () => window.clearTimeout(timer);
  }, [query, page, currentUrl, searchUrl, navigate]);

  // -------- branching --------

  if (frontloadMeta.pending) return <div>Loading ...</div>;
  if (frontloadMeta.error || data.searchResults.kind == "problem")
    return <div>API error!</div>;

  const numPages = Math.ceil(
    data.searchResults.state.total_num_results / data.searchResults.state.limit,
  );

  return (
    <div className="mt-6 mb-6">
      <div
        className="flex items-baseline justify-between text-dark-abyss italic
          border-b border-dark-abyss mb-1.5"
      >
        {data.searchResults.state.total_num_results} Results
      </div>
      <SearchResultsList
        searchResults={data.searchResults}
        loading={isLoading}
        onClickLink={() => {
          // The ItemLabel link performs the following navigation. Save the
          // live query first only when it is not already the current URL.
          if (currentUrl != searchUrl) navigate(searchUrl);
        }}
      />
      <Pager
        currentPage={page}
        numPages={numPages}
        linkHref={stringifyUrl({ url: "/search", query: { query } }) + "&page="}
      />
    </div>
  );
}
export default SearchResults;
