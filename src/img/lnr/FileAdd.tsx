import * as React from "react";

function SvgFileAdd(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.854 5.646l-4.5-4.5A.5.5 0 0013 1H3.5C2.673 1 2 1.673 2 2.5v16c0 .827.673 1.5 1.5 1.5h13c.827 0 1.5-.673 1.5-1.5V6a.504.504 0 00-.146-.354zM16.793 6H13.5a.5.5 0 01-.5-.5V2.207L16.793 6zM16.5 19h-13a.5.5 0 01-.5-.5v-16a.5.5 0 01.5-.5H12v3.5c0 .827.673 1.5 1.5 1.5H17v11.5a.5.5 0 01-.5.5z" />
      <path d="M11.5 13H9v-2.5a.5.5 0 00-1 0V13H5.5a.5.5 0 000 1H8v2.5a.5.5 0 001 0V14h2.5a.5.5 0 000-1z" />
    </svg>
  );
}

export default SvgFileAdd;
