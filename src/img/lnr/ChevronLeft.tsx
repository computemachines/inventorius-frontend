import * as React from "react";

function SvgChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14 20a.5.5 0 00.354-.853l-8.646-8.646 8.646-8.646a.5.5 0 00-.707-.707l-9 9a.5.5 0 000 .707l9 9a.498.498 0 00.354.146z" />
    </svg>
  );
}

export default SvgChevronLeft;
