import * as React from "react";

function SvgFrameContract(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14.5 9h-2c-.827 0-1.5-.673-1.5-1.5v-2a.5.5 0 011 0v2a.5.5 0 00.5.5h2a.5.5 0 010 1zM6.5 9h-2a.5.5 0 010-1h2a.5.5 0 00.5-.5v-2a.5.5 0 011 0v2C8 8.327 7.327 9 6.5 9zM11.5 16a.5.5 0 01-.5-.5v-2c0-.827.673-1.5 1.5-1.5h2a.5.5 0 010 1h-2a.5.5 0 00-.5.5v2a.5.5 0 01-.5.5zM7.5 16a.5.5 0 01-.5-.5v-2a.5.5 0 00-.5-.5h-2a.5.5 0 010-1h2c.827 0 1.5.673 1.5 1.5v2a.5.5 0 01-.5.5z" />
    </svg>
  );
}

export default SvgFrameContract;
