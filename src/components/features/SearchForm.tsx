// src/components/features/SearchForm.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)

import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { parse, stringifyUrl } from "query-string";

// import "../../styles/infoPanel.css";
import "../../styles/SearchForm.css";
import SearchResults from "./SearchResults";

const SEARCH_DELAY_MS = 120;

function SearchForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parse(location.search);
  const urlQuery = typeof parsed.query === "string" ? parsed.query : "";
  const parsedPage = typeof parsed.page === "string" ? Number(parsed.page) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [liveQuery, setLiveQuery] = useState(urlQuery);
  const [searchQuery, setSearchQuery] = useState(urlQuery);

  useEffect(() => {
    setLiveQuery(urlQuery);
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // A scanner enters a complete code as a rapid series of keyboard events.
  // Wait for that burst to finish instead of searching every partial prefix.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearchQuery(liveQuery),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [liveQuery]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = liveQuery.trim();
    setSearchQuery(query);
    navigate(
      query ? stringifyUrl({ url: "/search", query: { query } }) : "/search",
    );
  };

  return (
    <div className="search-form">
      <form onSubmit={submitSearch} autoComplete="off">
        <input
          type="text"
          name="query"
          id="query"
          autoComplete="off"
          value={liveQuery}
          onChange={(e) => setLiveQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          // A transient query starts at page one without rewriting the URL.
          page={searchQuery.trim() === urlQuery.trim() ? page : 1}
        />
      ) : (
        <p className="mt-4 text-sm text-[#6d635d]">
          Search by description, inventory label, or associated code.
        </p>
      )}
    </div>
  );
}
export default SearchForm;
