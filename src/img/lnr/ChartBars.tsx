import * as React from "react";

function SvgChartBars(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 20h-16C.673 20 0 19.327 0 18.5v-16C0 1.673.673 1 1.5 1h16c.827 0 1.5.673 1.5 1.5v16c0 .827-.673 1.5-1.5 1.5zM1.5 2a.5.5 0 00-.5.5v16a.5.5 0 00.5.5h16a.5.5 0 00.5-.5v-16a.5.5 0 00-.5-.5h-16z" />
      <path d="M6.5 17h-2a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v9a.5.5 0 01-.5.5zM5 16h1V8H5v8zM10.5 17h-2a.5.5 0 01-.5-.5v-12a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v12a.5.5 0 01-.5.5zM9 16h1V5H9v11zM14.5 17h-2a.5.5 0 01-.5-.5v-5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v5a.5.5 0 01-.5.5zM13 16h1v-4h-1v4z" />
    </svg>
  );
}

export default SvgChartBars;
