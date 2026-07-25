import * as React from "react";
import { createContext, useContext, useEffect } from "react";
import { useFrontload } from "react-frontload";

import type { AuthSessionResource } from "../../api-client/auth-contracts";
import type { FrontloadContext } from "../../api-client/api-client";
import { ApiContext } from "../../api-client/api-client";

type AuthContextValue = {
  session: AuthSessionResource | null;
  pending: boolean;
  hasOperation: (rel: string) => boolean;
  hasAuthOperation: (rel: string) => boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  pending: true,
  hasOperation: () => false,
  hasAuthOperation: () => false,
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

  return (
    <AuthContext.Provider
      value={{
        session,
        pending: frontloadMeta.pending,
        hasOperation: (rel) =>
          data?.application?.operations.some(
            (operation) => operation.rel === rel
          ) ?? false,
        hasAuthOperation: (rel) =>
          session?.operations.some((operation) => operation.rel === rel) ?? false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
