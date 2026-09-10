import type { RestOperation } from "./data-models";

export type PrincipalSummary = {
  id: string;
  display_name: string;
  kind: string;
};

export type AuthSessionState =
  | { status: "unconfigured"; principal: null; csrf_token?: string }
  | { status: "anonymous"; principal: null; csrf_token?: string }
  | {
      status: "authenticated";
      principal: PrincipalSummary;
      csrf_token: string | null;
    };

export type AuthSessionResource = {
  kind: "auth-session";
  Id: string;
  state: AuthSessionState;
  operations: RestOperation[];
};

export type ApplicationRootResource = {
  Id: "/api";
  state: { service: string };
  links: Array<{ rel: string; href: string }>;
  operations: RestOperation[];
};

export type PasskeyCeremony = {
  kind: "passkey-ceremony";
  Id?: string;
  state: {
    ceremony_id: string;
    public_key: Record<string, unknown>;
  };
  operations: RestOperation[];
};

export type PasskeyCredentialJSON = {
  id: string;
  rawId: string;
  type: "public-key";
  authenticatorAttachment?: string | null;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  response: Record<string, unknown>;
};

export type AuthVerificationResult = AuthSessionResource & {
  recovery_codes?: string[];
};

export type AuthSessionInventoryItem = {
  current: boolean;
  created_at: string;
  last_seen_at?: string;
  idle_expires_at?: string;
  expires_at: string;
  authentication_method: string;
};

export type AuthSessionsResource = {
  kind: "auth-sessions";
  Id: "/api/auth/sessions";
  state: { sessions: AuthSessionInventoryItem[] };
  operations: RestOperation[];
};

export type AuthAccessToken = {
  id: string;
  label: string;
  capabilities: string[];
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked: boolean;
};

export type AuthAccessTokensResource = {
  kind: "auth-access-tokens";
  Id: "/api/auth/access-tokens";
  state: { tokens: AuthAccessToken[] };
  operations: RestOperation[];
};

export type AuthAccessTokenCreatedResource = {
  kind: "auth-access-token-created";
  Id: string;
  state: { token: AuthAccessToken; secret: string };
  operations: RestOperation[];
};

export type AuthProblem = {
  kind: "problem";
  type: string;
  title: string;
  detail?: string;
};
