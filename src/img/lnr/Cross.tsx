import * as React from "react";

function SvgCross(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M10.707 10.5l5.646-5.646a.5.5 0 00-.707-.707L10 9.793 4.354 4.147a.5.5 0 00-.707.707L9.293 10.5l-5.646 5.646a.5.5 0 00.708.707l5.646-5.646 5.646 5.646a.498.498 0 00.708 0 .5.5 0 000-.707L10.709 10.5z" />
    </svg>
  );
}

export default SvgCross;
