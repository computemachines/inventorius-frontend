import * as React from "react";

function SvgSun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M9.5 14.993c-2.477 0-4.493-2.015-4.493-4.493S7.022 6.007 9.5 6.007s4.493 2.015 4.493 4.493-2.015 4.493-4.493 4.493zm0-7.986c-1.926 0-3.493 1.567-3.493 3.493s1.567 3.493 3.493 3.493 3.493-1.567 3.493-3.493S11.426 7.007 9.5 7.007zM9.5 5a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zM9.5 20a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zM3.5 11h-3a.5.5 0 010-1h3a.5.5 0 010 1zM18.5 11h-3a.5.5 0 010-1h3a.5.5 0 010 1zM4.5 6a.502.502 0 01-.354-.146l-2-2a.5.5 0 01.707-.707l2 2A.5.5 0 014.499 6zM2.5 18a.5.5 0 01-.354-.853l2-2a.5.5 0 01.707.707l-2 2a.498.498 0 01-.354.146zM16.5 18a.502.502 0 01-.354-.146l-2-2a.5.5 0 01.707-.707l2 2a.5.5 0 01-.354.853zM14.5 6a.5.5 0 01-.354-.853l2-2a.5.5 0 01.707.707l-2 2a.498.498 0 01-.354.146z" />
    </svg>
  );
}

export default SvgSun;
