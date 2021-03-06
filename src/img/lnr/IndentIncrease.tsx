import * as React from "react";

function SvgIndentIncrease(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 5h-15a.5.5 0 010-1h15a.5.5 0 010 1zM17.5 8h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 11h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 14h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 17h-15a.5.5 0 010-1h15a.5.5 0 010 1zM2.5 14a.5.5 0 01-.5-.5v-6a.5.5 0 01.8-.4l4 3a.5.5 0 010 .8l-4 3a.5.5 0 01-.3.1zM3 8.5v4l2.667-2L3 8.5z" />
    </svg>
  );
}

export default SvgIndentIncrease;
