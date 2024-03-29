import * as React from "react";
import {} from "react";

import "hamburgers/dist/hamburgers.css";
import "../styles/Topbar.css"; // must load after hamburgers.css

function Topbar({
  isActive,
  setActive,
}: {
  isActive: boolean;
  setActive: (isActive: boolean) => void;
}): JSX.Element {
  return (
    <div className="top-bar">
      <div className="branding">
        <div className="logo" />
        <h2>Inventorius</h2>
      </div>
      <button
        className={`hamburger hamburger--squeeze ${
          isActive ? "is-active" : ""
        }`}
        type="button"
        aria-label="Menu"
        aria-controls="navigation"
        onClick={() => {
          // console.log("button onClick");
          setActive(!isActive);
        }}
        onBlur={() => {
          // console.log("button onBlur");
          setActive(false);
        }}
        onFocus={() => {
          // console.log("button onFocus");
          // setActive(true);
        }}
      >
        <span className="hamburger-label">Menu</span>
        <span className="hamburger-box">
          <span className="hamburger-inner" />
        </span>
      </button>
    </div>
  );
}

export default Topbar;
