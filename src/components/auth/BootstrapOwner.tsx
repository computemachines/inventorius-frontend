import * as React from "react";
import { FormEvent, useContext, useState } from "react";
import { Link } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { createPasskey, passkeyError } from "../../api-client/webauthn";
import { useAuth } from "./AuthContext";

export default function BootstrapOwner() {
  const api = useContext(ApiContext);
  const { session, hasAuthOperation } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  if (recoveryCodes.length) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Save your recovery codes</h1>
        <p className="mb-4">
          Each code works once. Store them somewhere separate from your passkey.
          They will not be shown again.
        </p>
        <pre className="bg-gray-100 p-4 rounded select-all">
          {recoveryCodes.join("\n")}
        </pre>
        <a className="inline-block mt-6" href="/">
          Continue to Inventorius
        </a>
      </div>
    );
  }

  if (session && session.state.status !== "unconfigured") {
    return (
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Owner already configured</h1>
        <Link to="/login">Sign in</Link>
      </div>
    );
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ceremony = await api.startBootstrapRegistration(token);
      if (ceremony.kind === "problem") throw new Error(ceremony.title);
      const credential = await createPasskey(ceremony.state.public_key);
      const result = await api.finishBootstrapRegistration(ceremony, credential);
      if (result.kind === "problem") throw new Error(result.title);
      api.setCsrfToken(result.state.csrf_token);
      setRecoveryCodes(result.recovery_codes ?? []);
      if (!result.recovery_codes?.length) window.location.assign("/");
    } catch (caught) {
      setError(passkeyError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Set up the owner</h1>
      <p className="mb-6">
        Enter the short-lived bootstrap code created by the server, then save a
        discoverable passkey.
      </p>
      <form onSubmit={register}>
        <label className="block mb-2" htmlFor="bootstrap-token">
          Bootstrap code
        </label>
        <input
          className="block w-full border rounded p-2 mb-4"
          id="bootstrap-token"
          autoComplete="one-time-code"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <button
          className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50"
          type="submit"
          disabled={
            busy ||
            !token.trim() ||
            !hasAuthOperation("bootstrap-registration-options")
          }
        >
          {busy ? "Waiting for passkey…" : "Create owner passkey"}
        </button>
      </form>
      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
