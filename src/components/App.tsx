import "core-js/features/object";

import * as React from "react";
import { ReactNode, useState } from "react";
import { Navigate, Route, Routes, Link } from "react-router-dom";
import * as Sentry from "@sentry/react";

import ReactModal from "react-modal";

import "../styles/tailwind.css";
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
import Receive from "./features/Receive";
import MoveItem from "./features/MoveItem";
import Release from "./features/Release";
import Audit from "./features/Audit";
import SchemaDemo from "./features/SchemaDemo";
import SchemaAdmin from "./features/SchemaAdmin";
import AdminSettings from "./features/AdminSettings";
import QuickCapture from "./features/QuickCapture";
import NewProcessDefinition from "./features/NewProcessDefinition";
import ProcessDefinition from "./features/ProcessDefinition";
import ProcessDefinitionList from "./features/ProcessDefinitionList";
import InventoryActivity from "./features/InventoryActivity";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./auth/Login";
import BootstrapOwner from "./auth/BootstrapOwner";
import AccountSecurity from "./auth/AccountSecurity";

function RequireOperation({
  rel,
  children,
}: {
  rel: string;
  children: ReactNode;
}) {
  const { session, pending, hasOperation } = useAuth();
  if (pending) return <p>Checking access…</p>;
  if (!hasOperation(rel)) {
    const destination =
      session?.state.status === "unconfigured" ? "/setup" : "/login";
    return <Navigate to={destination} replace />;
  }
  return <>{children}</>;
}

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
    <AuthProvider>
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
                <Route path="/login" element={<Login />} />
                <Route path="/setup" element={<BootstrapOwner />} />
                <Route path="/account/security" element={<AccountSecurity />} />
                <Route path="/" element={<Home />} />
                <Route path="/new/bin" element={<RequireOperation rel="create-bin"><NewBin /></RequireOperation>} />
                <Route path="/new/sku" element={<RequireOperation rel="create-sku"><NewSkuForm /></RequireOperation>} />
                <Route path="/new/batch" element={<RequireOperation rel="create-batch"><NewBatchForm /></RequireOperation>} />
                <Route path="/processes/new" element={<RequireOperation rel="define-process"><NewProcessDefinition /></RequireOperation>} />
                <Route path="/processes/:id/edit" element={<RequireOperation rel="define-process"><ProcessDefinition editable /></RequireOperation>} />
                <Route path="/processes/:id" element={<ProcessDefinition />} />
                <Route path="/processes" element={<ProcessDefinitionList />} />
                <Route path="/bin/:id" element={<Bin />} />
                <Route path="/sku/:id/edit" element={<RequireOperation rel="create-sku"><Sku editable /></RequireOperation>} />
                <Route path="/sku/:id" element={<Sku />} />
                <Route path="/batch/:id/edit" element={<RequireOperation rel="create-batch"><Batch editable /></RequireOperation>} />
                <Route path="/batch/:id" element={<Batch />} />
                <Route path="/receive" element={<RequireOperation rel="inventory-operation"><Receive /></RequireOperation>} />
                <Route path="/capture" element={<RequireOperation rel="intake"><QuickCapture /></RequireOperation>} />
                <Route path="/release" element={<RequireOperation rel="inventory-operation"><Release /></RequireOperation>} />
                <Route path="/audit" element={<RequireOperation rel="audit-observation"><Audit /></RequireOperation>} />
                <Route
                  path="/activity/:operationId"
                  element={<InventoryActivity />}
                />
                <Route path="/move" element={<RequireOperation rel="inventory-operation"><MoveItem /></RequireOperation>} />
                <Route path="/search" element={<SearchForm />} />
                <Route path="/legal" element={<EULA />} />
                <Route path="/demo/schema" element={<SchemaDemo />} />
                <Route path="/admin/schema" element={<RequireOperation rel="schema-admin"><SchemaAdmin /></RequireOperation>} />
                <Route path="/admin/settings" element={<RequireOperation rel="schema-admin"><AdminSettings /></RequireOperation>} />
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
    </AuthProvider>
  );
}

export default App;
