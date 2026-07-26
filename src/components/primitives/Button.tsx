// inventorius-frontend/src/components/primitives/Button.tsx
// Fully human written: YES

import React, { ButtonHTMLAttributes } from "react";

interface Props {
  variant?: "primary" | "secondary";
  type?: "submit" | "reset" | "button" | undefined;
  children?: React.ReactNode;
}

export default function Button({ variant = "primary", children, type }: Props) {
  return (
    <button
      className="mt-4 mx-1 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30
        rounded inline-block"
      type={type}
    >
      {variant}
      {children}
    </button>
  );
}
