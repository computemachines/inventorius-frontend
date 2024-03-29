import "core-js/features/object";

import * as React from "react";
import { ReactNode, useState } from "react";
import { Route, Switch, Link } from "react-router-dom";
import * as Sentry from "@sentry/react";

import ReactModal from "react-modal";

import "normalize.css";
import "../styles/accessibility.css";
import "../styles/App.css";

import { ToastContext, Toast } from "./Toast";
import Topbar from "./Topbar";
import Navbar from "./Navbar";
import Home from "./Home";
import NewBin from "./NewBin";
import Bin from "./Bin";
import { FourOhFour } from "./FourOhFour";
import SearchForm from "./SearchForm";
import Sku from "./Sku";
import NewSku from "./NewSku";
import EULA from "./EULA";
import NewBatch from "./NewBatch";
import Batch from "./Batch";
import Receive from "./Receive";
import MoveItem from "./MoveItem";
import Release from "./Release";
import Audit from "./Audit";

/**
 * Main app component
 *
 * @returns React app component tree
 */
function App() {
  const [toastContent, setToastContent] = useState<{
    content?: ReactNode;
    mode?: "success" | "failure";
  }>({});
  const [dropdownIsActive, setDropdownIsActive] = useState(false);

  ReactModal.setAppElement("#react-root");

  return (
    <div className="app-wrapper">
      <div className="header-wrapper">
        <Topbar isActive={dropdownIsActive} setActive={setDropdownIsActive} />
        <Navbar isActive={dropdownIsActive} setActive={setDropdownIsActive} />
      </div>
      <div className="main-container">
        <div className="main-content" id="main">
          <Sentry.ErrorBoundary
            fallback={<h2>Something went wrong.</h2>}
            showDialog
          >
            <ToastContext.Provider value={{ setToastContent: setToastContent }}>
              <Toast
                onClose={() => setToastContent({ content: null })}
                mode={toastContent.mode}
              >
                {toastContent.content}
              </Toast>
              <Switch>
                <Route exact path="/">
                  <Home />
                </Route>
                <Route path="/new/bin">
                  <NewBin />
                </Route>
                <Route path="/new/sku">
                  <NewSku />
                </Route>
                <Route path="/new/batch">
                  <NewBatch />
                </Route>
                <Route path="/bin/:id">
                  <Bin />
                </Route>
                <Route path="/sku/:id/edit">
                  <Sku editable />
                </Route>
                <Route path="/sku/:id">
                  <Sku />
                </Route>
                <Route path="/batch/:id/edit">
                  <Batch editable />
                </Route>
                <Route path="/batch/:id">
                  <Batch />
                </Route>
                <Route path="/receive">
                  <Receive />
                </Route>
                <Route path="/release">
                  <Release />
                </Route>
                <Route path="/audit">
                  <Audit />
                </Route>
                <Route path="/move">
                  <MoveItem />
                </Route>
                <Route path="/search">
                  <SearchForm />
                </Route>
                <Route path="/legal">
                  <EULA />
                </Route>
                <Route>
                  <FourOhFour />
                </Route>
              </Switch>
            </ToastContext.Provider>
          </Sentry.ErrorBoundary>
        </div>
        <div className="footer-wrapper">
          <Link to="/legal">Legal</Link>
        </div>
      </div>
    </div>
  );
}

export default App;
