import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import {
  createPasskey,
  getPasskey,
  passkeyError,
} from "../../api-client/webauthn";
import type { AuthSessionInventoryItem } from "../../api-client/auth-contracts";
import { useAuth } from "./AuthContext";

export default function AccountSecurity() {
  const api = useContext(ApiContext);
  const { session, hasAuthOperation } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<AuthSessionInventoryItem[]>([]);

  const loadSessions = async () => {
    try {
      const inventory = await api.getAuthSessions();
      setSessions(inventory.state.sessions);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load sessions.",
      );
    }
  };

  useEffect(() => {
    if (session?.state.status === "authenticated") void loadSessions();
  }, [session?.state.status]);

  const confirmPasskey = async () => {
    const ceremony = await api.startRecentPasskeyAuthentication();
    if (ceremony.kind === "problem") throw new Error(ceremony.title);
    const credential = await getPasskey(ceremony.state.public_key);
    const result = await api.finishPasskeyAuthentication(ceremony, credential);
    if (result.kind === "problem") throw new Error(result.title);
  };

  if (session?.state.status !== "authenticated") {
    return (
      <div className="mx-auto max-w-xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">Security</h1>
        <Link to="/login?returnTo=/account/security">Sign in to continue</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4">
      <header
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <p
          className="text-sm font-medium uppercase tracking-wide text-slate-500"
        >
          Account
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Security & sessions
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          This is your single-owner account. Inventory remains public to browse;
          changes require this signed-in session.
        </p>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-slate-900">Passkeys</h2>
        <p className="mb-5 mt-2 text-slate-600">
          Add another synced passkey or hardware security key so one device is
          never your only way back in.
        </p>
        <button
          className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white
            shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
          type="button"
          disabled={busy || !hasAuthOperation("register-passkey-options")}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await confirmPasskey();
              const ceremony = await api.startAdditionalPasskeyRegistration();
              if (ceremony.kind === "problem") throw new Error(ceremony.title);
              const credential = await createPasskey(ceremony.state.public_key);
              const result = await api.finishBootstrapRegistration(
                ceremony,
                credential,
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
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Active sessions
            </h2>
            <p className="mt-1 text-slate-600">
              Sessions end after inactivity or their maximum lifetime.
            </p>
          </div>
          <button
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
            type="button"
            onClick={() => void loadSessions()}
          >
            Refresh
          </button>
        </div>
        <ul
          className="mt-5 divide-y divide-slate-100 rounded-lg border
            border-slate-100"
        >
          {sessions.map((item, index) => (
            <li
              className="flex items-center justify-between gap-4 p-4"
              key={`${item.created_at}-${index}`}
            >
              <div>
                <p className="font-medium text-slate-900">
                  {item.current ? "This browser" : "Another signed-in browser"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Last active{" "}
                  {item.last_seen_at
                    ? new Date(item.last_seen_at).toLocaleString()
                    : "recently"}
                </p>
              </div>
              {item.current && (
                <span
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs
                    font-medium text-emerald-700"
                >
                  Current
                </span>
              )}
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="p-4 text-slate-500">No active sessions found.</li>
          )}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2
              font-medium text-red-700 transition hover:bg-red-100
              disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setMessage("");
              try {
                await confirmPasskey();
                await api.logoutAllSessions();
                window.location.assign("/");
              } catch (caught) {
                setError(passkeyError(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Confirming…" : "Sign out every session"}
          </button>
          <p className="text-sm text-slate-500">
            Requires a fresh passkey confirmation, including this browser.
          </p>
        </div>
      </section>
      {message && <p className="mt-4 text-green-800">{message}</p>}
      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
