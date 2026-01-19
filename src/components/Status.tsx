import * as React from "react";

// NOTE: In react-router v6+, setting status codes for SSR requires data routers.
// This simplified version just renders children. SSR status code functionality
// would need to be reimplemented using createBrowserRouter/createStaticRouter.
export default function Status({
  code,
  children,
}: {
  code: number;
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
