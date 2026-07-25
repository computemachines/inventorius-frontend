import * as React from "react";
import { FormEvent, useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import {
  createPasskey,
  getPasskey,
  passkeyError,
} from "../../api-client/webauthn";
import { useAuth } from "./AuthContext";

function safeReturnTo(search: string): string {
  const candidate = new URLSearchParams(search).get("returnTo");
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/";
}

export default function Login() {
  const api = useContext(ApiContext);
  const { session, hasAuthOperation } = useAuth();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  if (session?.state.status === "authenticated") {
    return (
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Already signed in</h1>
        <Link to={safeReturnTo(location.search)}>Continue</Link>
      </div>
    );
  }

  if (session?.state.status === "unconfigured") {
    return (
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Owner setup required</h1>
        <p className="mb-4">
          Register the first owner passkey before signing in.
        </p>
        <Link to="/setup">Set up the owner</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <p className="mb-6">
        Use a passkey from this device, a security key, or a nearby phone.
      </p>
      <button
        className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50"
        type="button"
        disabled={busy || !hasAuthOperation("authenticate-passkey-options")}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const ceremony = await api.startPasskeyAuthentication();
            if (ceremony.kind === "problem") throw new Error(ceremony.title);
            const credential = await getPasskey(ceremony.state.public_key);
            const result = await api.finishPasskeyAuthentication(
              ceremony,
              credential
            );
            if (result.kind === "problem") throw new Error(result.title);
            window.location.assign(safeReturnTo(location.search));
          } catch (caught) {
            setError(passkeyError(caught));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Waiting for passkey…" : "Sign in with a passkey"}
      </button>
      {hasAuthOperation("recover-passkey-options") && (
        <details className="mt-8">
          <summary className="cursor-pointer">Use a recovery code</summary>
          <p className="my-3 text-sm">
            A recovery code is used once to register a replacement passkey.
          </p>
          <form
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const ceremony = await api.startRecoveryRegistration(recoveryCode);
                if (ceremony.kind === "problem") throw new Error(ceremony.title);
                const credential = await createPasskey(
                  ceremony.state.public_key
                );
                const result = await api.finishBootstrapRegistration(
                  ceremony,
                  credential
                );
                if (result.kind === "problem") throw new Error(result.title);
                window.location.assign(safeReturnTo(location.search));
              } catch (caught) {
                setError(passkeyError(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="mb-2 block" htmlFor="recovery-code">
              Recovery code
            </label>
            <input
              className="mb-3 block w-full rounded border p-2"
              id="recovery-code"
              autoComplete="one-time-code"
              required
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
            />
            <button
              className="rounded border border-blue-700 px-4 py-2 text-blue-800 disabled:opacity-50"
              type="submit"
              disabled={busy || !recoveryCode.trim()}
            >
              Register a replacement passkey
            </button>
          </form>
        </details>
      )}
      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
