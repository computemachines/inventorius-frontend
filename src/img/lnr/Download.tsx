import * as React from "react";

function SvgDownload(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14.853 9.647a.5.5 0 00-.707 0L10 13.793V2.5a.5.5 0 00-1 0v11.293L4.854 9.647a.5.5 0 00-.707.707l5 5a.498.498 0 00.708-.001l5-5a.5.5 0 000-.707z" />
      <path d="M17.5 19h-16C.673 19 0 18.327 0 17.5v-2a.5.5 0 011 0v2a.5.5 0 00.5.5h16a.5.5 0 00.5-.5v-2a.5.5 0 011 0v2c0 .827-.673 1.5-1.5 1.5z" />
    </svg>
  );
}

export default SvgDownload;
