// src/components/primitives/Status.tsx
// Fully human reviewed: YES
//
// Conversation:
// > (no discussion yet)

import React, { useContext } from "react";
import { ServerStatusContext } from "./ServerStatusContext";

export default function Status({
  code,
  children,
}: {
  code: number;
  children: React.ReactNode;
}): React.ReactElement {
  const status = useContext(ServerStatusContext);

  if (status) {
    status.statusCode = code;
  } else {
    // running on the client side. no-op
  }

  return <>{children}</>;
}
