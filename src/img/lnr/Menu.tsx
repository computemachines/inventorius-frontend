import * as React from "react";

function SvgMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 6h-15a.5.5 0 010-1h15a.5.5 0 010 1zM17.5 11h-15a.5.5 0 010-1h15a.5.5 0 010 1zM17.5 16h-15a.5.5 0 010-1h15a.5.5 0 010 1z" />
    </svg>
  );
}

export default SvgMenu;
