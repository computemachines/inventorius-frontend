import * as React from "react";
import { useContext, useState } from "react";
import { Link } from "react-router-dom";

import { ApiContext } from "../../api-client/api-client";
import { useAuth } from "./AuthContext";

export default function AuthStatus() {
  const api = useContext(ApiContext);
  const { session, pending, hasAuthOperation } = useAuth();
  const [error, setError] = useState("");

  if (pending || !session) return <span className="auth-status">Checking access…</span>;

  if (session.state.status === "unconfigured") {
    return (
      <Link className="auth-status" to="/setup">
        Set up owner
      </Link>
    );
  }

  if (session.state.status === "authenticated") {
    return (
      <span className="auth-status">
        <Link to="/account/security">
          {session.state.principal.display_name}
        </Link>
        {hasAuthOperation("logout") && (
          <button
            type="button"
            onClick={async () => {
              setError("");
              try {
                await api.logout();
                window.location.assign("/");
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to sign out.");
              }
            }}
          >
            Sign out
          </button>
        )}
        {error && <span role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <Link className="auth-status" to="/login">
      Sign in
    </Link>
  );
}
