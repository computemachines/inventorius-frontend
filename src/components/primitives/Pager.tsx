// src/components/primitives/Pager.tsx
// Fully human reviewed: YES
// Fully human written: MOSTLY
// Progress: N/A
//
// Conversation:
// > (no discussion yet)

import * as React from "react";
import { Link } from "react-router-dom";

import clsx from "clsx";

/**
 * linkHref must end in argument page=
 */
export const Pager: React.FC<{
  currentPage: number;
  numPages: number;
  linkHref: string;
  scrollToTop?: boolean;
}> = ({ currentPage: page, numPages, linkHref, scrollToTop = true }) => {
  const shownPageLinks = [page - 2, page - 1, page, page + 1, page + 2].filter(
    // actually exists
    (p) => p >= 1 && p <= numPages,
  );
  const hasPrevPage = page > 1;
  const hasNextPage = page < numPages;
  const showJumpToStart = page - 2 > 1;
  const showJumpToEnd = page + 2 < numPages;

  if (!numPages) return null;

  const onClick = scrollToTop ? () => window.scrollTo(0, 0) : () => {};

  const pageLink = (
    toPage: number,
    isActive = false,
    children?: React.ReactNode,
  ) => (
    <Link
      key={toPage}
      onClick={onClick}
      to={linkHref + toPage}
      className={clsx("mr-0.5 p-2 rounded no-underline", {
        "bg-accent text-white": isActive,
        "bg-white text-black": !isActive,
      })}
    >
      {children || toPage}
    </Link>
  );

  return (
    <div className="flex items-baseline justify-center font-semibold mt-2">
      <span className="mr-2">Page:</span>
      {showJumpToStart && pageLink(1, false, "|<")}
      {hasPrevPage && pageLink(page - 1, false, "<")}
      {showJumpToStart && "..."}
      {shownPageLinks.map((p) => pageLink(p, p === page))}
      {showJumpToEnd && "..."}
      {hasNextPage && pageLink(page + 1, false, ">")}
      {showJumpToEnd && pageLink(numPages, false, ">|")}
    </div>
  );
};
