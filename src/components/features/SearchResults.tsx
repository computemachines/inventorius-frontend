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
  SearchResult,
  SearchResults as APISearchResults,
} from "../../api-client/data-models";

import { stringifyUrl } from "query-string";
import DataTable, { HeaderSpec } from "../composites/DataTable";
import { Pager } from "../primitives/Pager";

function resultToType(result: SearchResult): "SKU" | "BATCH" | "BIN" {
  if (isBinState(result)) return "BIN";
  if (isSkuState(result)) return "SKU";
  if (isBatchState(result)) return "BATCH";
}

function SearchResultsTable({
  searchResults,
  loading,
  onClickLink,
}: {
  searchResults: APISearchResults;
  loading?: boolean;
  onClickLink?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const searchResultToDataRow = (result: SearchResult) => ({
    Identifier: result.id,
    Name: !isBinState(result) ? result.name : "",
    Type: resultToType(result),
  });
  const tabularData = searchResults.state.results.map(searchResultToDataRow);
  return (
    <DataTable
      headers={["Identifier", "Name", "Type"]}
      data={tabularData}
      onClickLink={onClickLink}
      headerSpecs={{
        Identifier: new HeaderSpec(".ItemLabel"),
        Name: new HeaderSpec(".truncated", {
          kind: "min-max-width",
          minWidth: 100,
          maxWidth: "1fr",
        }),
        // Quantity: new HeaderSpec(".numeric"),
      }}
      loading={loading}
    />
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
      <SearchResultsTable
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
