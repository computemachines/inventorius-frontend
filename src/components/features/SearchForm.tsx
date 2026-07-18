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

function SearchForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parse(location.search);
  const urlQuery = typeof parsed.query === "string" ? parsed.query : "";
  const parsedPage = typeof parsed.page === "string" ? Number(parsed.page) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [liveQuery, setLiveQuery] = useState(urlQuery);

  useEffect(() => setLiveQuery(urlQuery), [urlQuery]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = liveQuery.trim();
    navigate(query ? stringifyUrl({ url: "/search", query: { query } }) : "/search");
  };

  return (
    <div className="search-form">
      <form onSubmit={submitSearch}>
        <input
          type="text"
          name="query"
          id="query"
          value={liveQuery}
          onChange={(e) => setLiveQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      {urlQuery ? (
        <SearchResults
          query={urlQuery}
          page={page}
          unsetPage={() => {
            navigate(stringifyUrl({ url: "/search", query: { query: urlQuery } }));
          }}
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
