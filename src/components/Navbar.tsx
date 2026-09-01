import * as React from "react";
import { NavLink } from "react-router-dom";
import NavlinkDropdown from "./primitives/NavlinkDropdown";

import "../styles/Navbar.css";
import { useAuth } from "./auth/AuthContext";

function Navbar({
  isActive,
  setActive,
}: {
  isActive: boolean;
  setActive: (s: boolean) => void;
}) {
  const { hasOperation } = useAuth();
  const canMutateCatalog =
    hasOperation("create-bin") ||
    hasOperation("create-sku") ||
    hasOperation("create-batch");
  const canMutateInventory = hasOperation("inventory-operation");
  const canUseAdmin = hasOperation("schema-admin") || hasOperation("solver-query");
  return (
    <nav
      onBlur={() => {
        // console.log("nav onblur");
        // setActive(false);
      }}
      onFocus={() => {
        // console.log("nav onFocus");
        setActive(true);
      }}
      onClick={() => {
        // console.log("nav onClick");
        setActive(false);
      }}
      className={`navbar screen-reader ${isActive ? "screen-reader-show" : ""}`}
    >
      <NavLink className="navlink" to="/">
        Home
      </NavLink>
      {hasOperation("intake") && (
        <NavLink className="navlink" to="/capture">
          Quick Capture
        </NavLink>
      )}
      {canMutateCatalog && (
        <NavlinkDropdown text="New">
          {hasOperation("create-bin") && (
            <NavLink className="navlink" to="/new/bin">
              New Bin
            </NavLink>
          )}
          {hasOperation("create-sku") && (
            <NavLink className="navlink" to="/new/sku">
              Define SKU
            </NavLink>
          )}
          {hasOperation("create-batch") && (
            <NavLink className="navlink" to="/new/batch">
              Define Batch
            </NavLink>
          )}
          {hasOperation("define-process") && (
            <NavLink className="navlink" to="/processes/new">
              Define Process
            </NavLink>
          )}
        </NavlinkDropdown>
      )}
      <NavLink className="navlink" to="/processes">
        Manufacturing
      </NavLink>
      {canMutateInventory && (
        <>
          <NavLink className="navlink" to="/move">
            Move
          </NavLink>
          <NavLink className="navlink" to="/audit">
            Audit
          </NavLink>
          <NavLink className="navlink" to="/receive">
            Receive
          </NavLink>
          <NavLink className="navlink" to="/release">
            Release
          </NavLink>
        </>
      )}
      {canUseAdmin ? (
        <NavlinkDropdown text="Admin">
          {hasOperation("schema-admin") && (
            <>
              <NavLink className="navlink" to="/admin/schema">
                Schema Admin
              </NavLink>
              <NavLink className="navlink" to="/demo/schema">
                Schema Demo
              </NavLink>
              <NavLink className="navlink" to="/admin/settings">
                Settings
              </NavLink>
            </>
          )}
          {hasOperation("solver-query") && (
            <NavLink className="navlink" to="/admin/solver">
              Solver Lab
            </NavLink>
          )}
        </NavlinkDropdown>
      ) : (
        <NavLink className="navlink" to="/demo/schema">
          Schema Demo
        </NavLink>
      )}
      <NavLink className="navlink" to="/search">
        Search
      </NavLink>
    </nav>
  );
}

export default Navbar;
