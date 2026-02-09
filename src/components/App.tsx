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

import { ToastContext, Toast } from "./primitives/Toast";
import Topbar from "./Topbar";
import Navbar from "./Navbar";
import Home from "./features/Home";
import NewBin from "./features/NewBin";
import Bin from "./features/Bin";
import { FourOhFour } from "./primitives/FourOhFour";
import SearchForm from "./features/SearchForm";
import Sku from "./features/Sku";
import NewSkuForm from "./features/NewSkuForm";
import NewBatchForm from "./features/NewBatchForm";
import EULA from "./primitives/EULA";
import Batch from "./features/Batch";
// Receive component removed - will be redesigned
import MoveItem from "./features/MoveItem";
import Release from "./features/Release";
import Audit from "./features/Audit";
import SchemaDemo from "./features/SchemaDemo";
import SchemaAdmin from "./features/SchemaAdmin";

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
                <Route path="/new/sku" element={<NewSkuForm />} />
                <Route path="/new/batch" element={<NewBatchForm />} />
                <Route path="/bin/:id" element={<Bin />} />
                <Route path="/sku/:id/edit" element={<Sku editable />} />
                <Route path="/sku/:id" element={<Sku />} />
                <Route path="/batch/:id/edit" element={<Batch editable />} />
                <Route path="/batch/:id" element={<Batch />} />
                {/* /receive route removed - will be redesigned */}
                <Route path="/release" element={<Release />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/move" element={<MoveItem />} />
                <Route path="/search" element={<SearchForm />} />
                <Route path="/legal" element={<EULA />} />
                <Route path="/demo/schema" element={<SchemaDemo />} />
                <Route path="/admin/schema" element={<SchemaAdmin />} />
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
