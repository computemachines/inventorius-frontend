import * as React from "react";

function SvgArrowUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M9.146.646l-6 6a.5.5 0 00.707.707l5.146-5.146V18.5a.5.5 0 001 0V2.207l5.146 5.146a.5.5 0 00.707-.708l-6-6a.5.5 0 00-.707 0z" />
    </svg>
  );
}

export default SvgArrowUp;
