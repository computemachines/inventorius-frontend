import * as React from "react";

function SvgTextFormat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M16.5 19h-14a.5.5 0 010-1h14a.5.5 0 010 1zM15.96 15.303l-2.57-5.996-.002-.004-3.428-8a.5.5 0 00-.92 0l-3.428 8-.002.005-2.57 5.996a.5.5 0 10.92.394l2.442-5.697H12.6l2.442 5.697a.5.5 0 00.657.262.501.501 0 00.263-.657zM6.83 9L9.5 2.769 12.17 9H6.829z" />
    </svg>
  );
}

export default SvgTextFormat;