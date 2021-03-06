import * as React from "react";

function SvgWarning(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M18.5 19H.5a.5.5 0 01-.436-.746l9-16a.501.501 0 01.872 0l9 16A.503.503 0 0118.5 19zM1.355 18h16.29L9.5 3.52 1.355 18z" />
      <path d="M9.5 14a.5.5 0 01-.5-.5v-5a.5.5 0 011 0v5a.5.5 0 01-.5.5zM9.5 17a.5.5 0 01-.5-.5v-1a.5.5 0 011 0v1a.5.5 0 01-.5.5z" />
    </svg>
  );
}

export default SvgWarning;
