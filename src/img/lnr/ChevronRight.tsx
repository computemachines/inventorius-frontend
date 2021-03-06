import * as React from "react";

function SvgChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M5 20a.5.5 0 01-.354-.853l8.646-8.646-8.646-8.646a.5.5 0 01.707-.707l9 9a.5.5 0 010 .707l-9 9a.498.498 0 01-.354.146z" />
    </svg>
  );
}

export default SvgChevronRight;
