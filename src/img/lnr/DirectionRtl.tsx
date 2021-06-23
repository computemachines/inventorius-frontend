import * as React from "react";

function SvgDirectionRtl(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M15.5 1H7C4.794 1 3 2.794 3 5s1.794 4 4 4h1v4.5a.5.5 0 001 0V2h3v11.5a.5.5 0 001 0V2h2.5a.5.5 0 000-1zM8 8H7C5.346 8 4 6.654 4 5s1.346-3 3-3h1v6zM14.5 17H5.207l1.146-1.146a.5.5 0 00-.707-.707l-2 2a.5.5 0 000 .707l2 2a.498.498 0 00.708 0 .5.5 0 000-.707l-1.146-1.146h9.293a.5.5 0 000-1z" />
    </svg>
  );
}

export default SvgDirectionRtl;
