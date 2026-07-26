import * as React from "react";
import { useContext, useState } from "react";
import { Link } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { createPasskey, passkeyError } from "../../api-client/webauthn";
import { useAuth } from "./AuthContext";

export default function AccountSecurity() {
  const api = useContext(ApiContext);
  const { session, hasAuthOperation } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (session?.state.status !== "authenticated") {
    return (
      <div className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">Security</h1>
        <Link to="/login?returnTo=/account/security">Sign in to continue</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Security</h1>
      <p className="mb-6">
        Add another synced passkey or hardware security key so one device is
        never your only way back in.
      </p>
      <button
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        type="button"
        disabled={busy || !hasAuthOperation("register-passkey-options")}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          setError("");
          try {
            const ceremony = await api.startAdditionalPasskeyRegistration();
            if (ceremony.kind === "problem") throw new Error(ceremony.title);
            const credential = await createPasskey(ceremony.state.public_key);
            const result = await api.finishBootstrapRegistration(
              ceremony,
              credential
            );
            if (result.kind === "problem") throw new Error(result.title);
            setMessage("Passkey added.");
          } catch (caught) {
            setError(passkeyError(caught));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Waiting for passkey…" : "Add another passkey"}
      </button>
      {message && <p className="mt-4 text-green-800">{message}</p>}
      {error && <p className="mt-4 text-red-700" role="alert">{error}</p>}
    </div>
  );
}
