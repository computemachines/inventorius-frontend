// src/components/features/AdminSettings.tsx
// Fully human written: YES

import * as React from "react";

import PageHeading from "@components/primitives/PageHeading";
import Button from "@components/primitives/Button";

const AdminSettings: React.FC<{}> = () => {
  return (
    <div>
      <PageHeading>Admin Settings</PageHeading>
      <div className="flex-row">
        <Button>Submit</Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </div>
  );
};

export default AdminSettings;
