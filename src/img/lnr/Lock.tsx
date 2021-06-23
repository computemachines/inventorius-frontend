import * as React from "react";

function SvgLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14.5 8H14V6.5C14 4.019 11.981 2 9.5 2S5 4.019 5 6.5V8h-.5C3.673 8 3 8.673 3 9.5v8c0 .827.673 1.5 1.5 1.5h10c.827 0 1.5-.673 1.5-1.5v-8c0-.827-.673-1.5-1.5-1.5zM6 6.5C6 4.57 7.57 3 9.5 3S13 4.57 13 6.5V8H6V6.5zm9 11a.5.5 0 01-.5.5h-10a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5h10a.5.5 0 01.5.5v8z" />
    </svg>
  );
}

export default SvgLock;
