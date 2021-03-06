import * as React from "react";

function SvgPageBreak(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 9h-15C1.673 9 1 8.327 1 7.5v-6a.5.5 0 011 0v6a.5.5 0 00.5.5h15a.5.5 0 00.5-.5v-6a.5.5 0 011 0v6c0 .827-.673 1.5-1.5 1.5zM1.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM4.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM7.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM10.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM13.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM16.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM19.5 11h-1a.5.5 0 010-1h1a.5.5 0 010 1zM18.5 20a.5.5 0 01-.5-.5v-6a.5.5 0 00-.5-.5h-15a.5.5 0 00-.5.5v6a.5.5 0 01-1 0v-6c0-.827.673-1.5 1.5-1.5h15c.827 0 1.5.673 1.5 1.5v6a.5.5 0 01-.5.5z" />
    </svg>
  );
}

export default SvgPageBreak;
