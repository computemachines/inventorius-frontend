// src/components/primitives/Pager.tsx
// Fully human reviewed: YES
// Fully human written: YES
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
    (p) => p >= 1 && p <= numPages
  );
  const hasPrevPage = page > 1;
  const hasNextPage = page < numPages;
  const showJumpToStart = page - 2 > 1;
  const showJumpToEnd = page + 2 < numPages;

  if (!numPages) return null;

  const onClick = scrollToTop ? () => window.scrollTo(0, 0) : () => {};

  const PageLink = ({
    children,
    toPage,
    isActive = false,
  }: {
    children?: React.ReactNode;
    toPage: number;
    isActive?: boolean;
  }) => (
    <Link
      onClick={onClick}
      to={linkHref + toPage}
      className={clsx("mr-0.5 p-2 bg-white text-black rounded no-underline", {
        "pager--page-link__active": isActive,
      })}
    >
      {children || toPage}
    </Link>
  );

  return (
    <div className="flex items-baseline justify-center font-semibold">
      <span className="mr-2">Page:</span>
      {showJumpToStart && <PageLink toPage={1}>|&lt;</PageLink>}
      {hasPrevPage && <PageLink toPage={page - 1}>&lt;</PageLink>}
      {showJumpToStart && "..."}
      {shownPageLinks.map((p) => (
        <PageLink toPage={p} key={p} isActive={p === page} />
      ))}
      {showJumpToEnd && "..."}
      {hasNextPage && <PageLink toPage={page + 1}>&gt;</PageLink>}
      {showJumpToEnd && <PageLink toPage={numPages}>&gt;|</PageLink>}
    </div>
  );
};
