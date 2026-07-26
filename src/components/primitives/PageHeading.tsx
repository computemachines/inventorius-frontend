// inventorius-frontend/src/components/primitives/PageHeading.tsx
// Fully human written: YES

import React from "react";

interface Props {
  children: React.ReactNode;
}

const PageHeading = ({ children }: Props) => {
  return (
    <h2
      className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2
        border-[#cdd2d6]"
    >
      {children}
    </h2>
  );
};

export default PageHeading;
