import * as React from "react";

function SvgSelect(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M5.5 15h-4C.673 15 0 14.327 0 13.5v-12C0 .673.673 0 1.5 0h14c.827 0 1.5.673 1.5 1.5v7a.5.5 0 01-1 0v-7a.5.5 0 00-.5-.5h-14a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h4a.5.5 0 010 1z" />
      <path d="M13 20a.5.5 0 01-.464-.314l-1.697-4.242-2.963 3.386A.5.5 0 017 18.501v-15a.5.5 0 01.837-.37l11 10a.499.499 0 01-.336.87H14.24l1.726 4.314a.5.5 0 01-.279.65l-2.5 1a.508.508 0 01-.186.036zm-2-6a.5.5 0 01.464.314l1.814 4.536 1.572-.629-1.814-4.536a.499.499 0 01.464-.686h3.707L8 4.629v12.539l2.624-2.999a.501.501 0 01.376-.171z" />
    </svg>
  );
}

export default SvgSelect;
