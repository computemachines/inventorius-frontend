import "core-js/features/object";

import * as React from "react";
import { ReactNode, useState } from "react";
import { Route, Routes, Link } from "react-router-dom";
import * as Sentry from "@sentry/react";

import ReactModal from "react-modal";

import "../styles/tailwind.css";
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
import NewSkuFormDynamic from "./NewSkuFormDynamic";
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
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/new/bin" element={<NewBin />} />
                <Route path="/new/sku" element={<NewSku />} />
                <Route path="/new/sku/dynamic" element={<NewSkuFormDynamic />} />
                <Route path="/new/batch" element={<NewBatch />} />
                <Route path="/bin/:id" element={<Bin />} />
                <Route path="/sku/:id/edit" element={<Sku editable />} />
                <Route path="/sku/:id" element={<Sku />} />
                <Route path="/batch/:id/edit" element={<Batch editable />} />
                <Route path="/batch/:id" element={<Batch />} />
                <Route path="/receive" element={<Receive />} />
                <Route path="/release" element={<Release />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/move" element={<MoveItem />} />
                <Route path="/search" element={<SearchForm />} />
                <Route path="/legal" element={<EULA />} />
                <Route path="*" element={<FourOhFour />} />
              </Routes>
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
