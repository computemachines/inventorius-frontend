import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import {
  createPasskey,
  getPasskey,
  passkeyError,
} from "../../api-client/webauthn";
import type {
  AuthAccessToken,
  AuthSessionInventoryItem,
} from "../../api-client/auth-contracts";
import { useAuth } from "./AuthContext";

export default function AccountSecurity() {
  const api = useContext(ApiContext);
  const { session, hasAuthOperation } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<AuthSessionInventoryItem[]>([]);
  const [tokens, setTokens] = useState<AuthAccessToken[]>([]);
  const [tokenLabel, setTokenLabel] = useState("Inventory Assistant");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [allowInventoryChanges, setAllowInventoryChanges] = useState(false);
  const [allowFileUploads, setAllowFileUploads] = useState(false);
  const [newTokenSecret, setNewTokenSecret] = useState("");

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

  const loadTokens = async () => {
    try {
      const inventory = await api.getAccessTokens();
      setTokens(inventory.state.tokens);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load application tokens.",
      );
    }
  };

  useEffect(() => {
    if (session?.state.status === "authenticated") {
      void loadSessions();
      void loadTokens();
    }
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

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-slate-900">
          Application tokens
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Create a token to connect the Inventory Assistant desktop app. It can
          read inventory and edit catalog items and schemas. It cannot receive,
          move, release, or count stock unless you grant that extra authority
          below. It cannot upload files or change account security.
        </p>

        <form
          className="mt-5 grid max-w-xl gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            setNewTokenSecret("");
            try {
              await confirmPasskey();
              const created = await api.createAccessToken(
                tokenLabel,
                expiresInDays,
                allowInventoryChanges,
                allowFileUploads,
              );
              setNewTokenSecret(created.state.secret);
              setTokens((current) => [created.state.token, ...current]);
              setMessage(
                "Application token created. Copy it into the desktop app now.",
              );
            } catch (caught) {
              setError(passkeyError(caught));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Token name
            <input
              className="rounded-lg border border-slate-300 px-3 py-2
                font-normal"
              maxLength={100}
              required
              value={tokenLabel}
              onChange={(event) => setTokenLabel(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Expires after
            <select
              className="rounded-lg border border-slate-300 px-3 py-2
                font-normal"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-800">
            <input
              className="mt-1"
              type="checkbox"
              checked={allowInventoryChanges}
              onChange={(event) => setAllowInventoryChanges(event.target.checked)}
            />
            <span>
              <span className="font-medium">
                Allow stock operations (receive, move, consume)
              </span>
              <span className="mt-1 block text-slate-600">
                Optional extra authority. Leave unchecked for catalog-only
                access.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-800">
            <input className="mt-1" type="checkbox" checked={allowFileUploads}
              onChange={(event) => setAllowFileUploads(event.target.checked)} />
            <span>
              <span className="font-medium">Allow file uploads</span>
              <span className="mt-1 block text-slate-600">
                Attach photos and documents to properties. Uploaded files are publicly readable.
                This does not allow file deletion.
              </span>
            </span>
          </label>
          <button
            className="w-fit rounded-lg bg-blue-700 px-4 py-2 font-medium
              text-white shadow-sm transition hover:bg-blue-800
              disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? "Confirming…" : "Create token"}
          </button>
        </form>

        {newTokenSecret && (
          <div
            className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4"
          >
            <p className="font-medium text-amber-950">
              Copy this token now. Inventorius will not show it again.
            </p>
            <code
              className="mt-3 block break-all rounded bg-white p-3 text-sm
                text-slate-900"
            >
              {newTokenSecret}
            </code>
            <button
              className="mt-3 rounded-lg border border-amber-400 bg-white px-3
                py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newTokenSecret);
                  setMessage("Token copied.");
                  setError("");
                } catch {
                  setError(
                    "Copy failed. Select the token text and copy it manually.",
                  );
                }
              }}
            >
              Copy token
            </button>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">
            Existing tokens
          </h3>
          <button
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
            type="button"
            onClick={() => void loadTokens()}
          >
            Refresh
          </button>
        </div>
        <ul
          className="mt-3 divide-y divide-slate-100 rounded-lg border
            border-slate-100"
        >
          {tokens.map((token) => {
            const expired = new Date(token.expires_at).getTime() <= Date.now();
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-4
                  p-4"
                key={token.id}
              >
                <div>
                  <p className="font-medium text-slate-900">{token.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {token.revoked
                      ? "Revoked"
                      : expired
                        ? "Expired"
                        : `Expires ${new Date(token.expires_at).toLocaleString()}`}
                  </p>
                </div>
                {!token.revoked && !expired && (
                  <button
                    className="rounded-lg border border-red-200 bg-red-50 px-3
                      py-2 text-sm font-medium text-red-700 hover:bg-red-100
                      disabled:opacity-50"
                    disabled={busy}
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      setMessage("");
                      try {
                        await confirmPasskey();
                        const revoked = await api.revokeAccessToken(token.id);
                        setTokens((current) =>
                          current.map((item) =>
                            item.id === token.id ? revoked : item,
                          ),
                        );
                        setMessage(`${token.label} revoked.`);
                      } catch (caught) {
                        setError(passkeyError(caught));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            );
          })}
          {tokens.length === 0 && (
            <li className="p-4 text-slate-500">No application tokens yet.</li>
          )}
        </ul>
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
