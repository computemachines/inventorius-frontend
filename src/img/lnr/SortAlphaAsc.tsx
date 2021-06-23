import * as React from "react";

function SvgSortAlphaAsc(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M8.854 14.646a.5.5 0 00-.707 0l-3.146 3.146V.499a.5.5 0 00-1 0v17.293L.855 14.646a.5.5 0 00-.707.707l4 4a.498.498 0 00.708 0l4-4a.5.5 0 000-.707zM19.96 7.303l-3-7a.5.5 0 00-.92 0l-3 7a.5.5 0 10.92.394L15.116 5h2.769l1.156 2.697a.5.5 0 00.657.262.501.501 0 00.263-.657zM15.544 4l.956-2.231L17.456 4h-1.912zM18.5 20h-4a.5.5 0 01-.434-.748L17.639 13h-3.138a.5.5 0 010-1h4a.5.5 0 01.434.748L15.362 19H18.5a.5.5 0 010 1z" />
    </svg>
  );
}

export default SvgSortAlphaAsc;
