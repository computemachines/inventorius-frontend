import * as React from "react";

function SvgCode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M5 15a.502.502 0 01-.354-.146l-4-4a.5.5 0 010-.707l4-4a.5.5 0 01.707.707L1.707 10.5l3.646 3.646a.5.5 0 01-.354.853zM15 15a.5.5 0 01-.354-.853l3.646-3.646-3.646-3.646a.5.5 0 01.707-.707l4 4a.5.5 0 010 .707l-4 4a.498.498 0 01-.354.146zM7.5 15a.5.5 0 01-.424-.765l5-8a.5.5 0 01.848.53l-5 8A.5.5 0 017.5 15z" />
    </svg>
  );
}

export default SvgCode;
