import * as React from "react";
import { createContext, useContext, useEffect } from "react";
import { useFrontload } from "react-frontload";

import type { AuthSessionResource } from "../../api-client/auth-contracts";
import type { FrontloadContext } from "../../api-client/api-client";
import { ApiContext } from "../../api-client/api-client";
import type { RestOperation } from "../../api-client/data-models";

type AuthContextValue = {
  session: AuthSessionResource | null;
  pending: boolean;
  hasOperation: (rel: string) => boolean;
  applicationOperation: (rel: string) => RestOperation | undefined;
  hasAuthOperation: (rel: string) => boolean;
  authOperation: (rel: string) => RestOperation | undefined;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  pending: true,
  hasOperation: () => false,
  applicationOperation: () => undefined,
  hasAuthOperation: () => false,
  authOperation: () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const api = useContext(ApiContext);
  const { data, frontloadMeta } = useFrontload(
    "auth-session",
    async ({ api: frontloadApi }: FrontloadContext) => {
      const [session, application] = await Promise.all([
        frontloadApi.getAuthSession(),
        frontloadApi.getApplicationRoot(),
      ]);
      return { session, application };
    }
  );
  const session = (data?.session as AuthSessionResource | undefined) ?? null;

  useEffect(() => {
    api.setCsrfToken(session?.state.csrf_token);
  }, [api, session?.state.csrf_token]);

  const applicationOperation = (rel: string) => {
    const operation = data?.application?.operations.find(
      (candidate) => candidate.rel === rel,
    );
    return operation ? api.hydrateOperation(operation) : undefined;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        pending: frontloadMeta.pending,
        hasOperation: (rel) =>
          data?.application?.operations.some(
            (operation) => operation.rel === rel
          ) ?? false,
        applicationOperation,
        hasAuthOperation: (rel) =>
          session?.operations.some((operation) => operation.rel === rel) ?? false,
        authOperation: (rel) =>
          session?.operations.find((operation) => operation.rel === rel),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
