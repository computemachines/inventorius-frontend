import * as React from "react";

function SvgFrameExpand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M18.5 7a.5.5 0 01-.5-.5v-2a.5.5 0 00-.5-.5h-2a.5.5 0 010-1h2c.827 0 1.5.673 1.5 1.5v2a.5.5 0 01-.5.5zM.5 7a.5.5 0 01-.5-.5v-2C0 3.673.673 3 1.5 3h2a.5.5 0 010 1h-2a.5.5 0 00-.5.5v2a.5.5 0 01-.5.5zM3.5 18h-2C.673 18 0 17.327 0 16.5v-2a.5.5 0 011 0v2a.5.5 0 00.5.5h2a.5.5 0 010 1zM17.5 18h-2a.5.5 0 010-1h2a.5.5 0 00.5-.5v-2a.5.5 0 011 0v2c0 .827-.673 1.5-1.5 1.5z" />
    </svg>
  );
}

export default SvgFrameExpand;
