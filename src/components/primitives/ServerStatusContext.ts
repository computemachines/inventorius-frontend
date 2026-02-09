import { useContext, createContext } from "react";

export interface ServerStatus {
  statusCode: number;
}

/**
 * Context for passing http status info up to the ssr processes on http request.
 */
export const ServerStatusContext = createContext<ServerStatus | null>(null);
