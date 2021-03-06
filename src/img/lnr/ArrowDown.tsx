import * as React from "react";

function SvgArrowDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M9.854 19.354l6-6a.5.5 0 00-.707-.707l-5.146 5.146V1.5a.5.5 0 00-1 0v16.293l-5.146-5.146a.5.5 0 00-.707.708l6 6a.5.5 0 00.707 0z" />
    </svg>
  );
}

export default SvgArrowDown;
