import * as React from "react";

function SvgStrikethrough(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M16.5 2h-14a.5.5 0 000 1H9v4.5a.5.5 0 001 0V3h6.5a.5.5 0 000-1zM9.5 18a.5.5 0 01-.5-.5v-4a.5.5 0 011 0v4a.5.5 0 01-.5.5zM18.5 12H.5a.5.5 0 01-.5-.5v-2A.5.5 0 01.5 9h18a.5.5 0 01.5.5v2a.5.5 0 01-.5.5zM1 11h17v-1H1v1z" />
    </svg>
  );
}

export default SvgStrikethrough;
