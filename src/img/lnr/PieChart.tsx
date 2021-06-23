import * as React from "react";

function SvgPieChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M8.5 20c-2.27 0-4.405-.884-6.01-2.49S0 13.77 0 11.5c0-2.27.884-4.405 2.49-6.01S6.23 3 8.5 3a.5.5 0 01.5.5V11h7.5a.5.5 0 01.5.5c0 2.27-.884 4.405-2.49 6.01S10.77 20 8.5 20zM8 4.016c-3.903.258-7 3.516-7 7.484C1 15.636 4.364 19 8.5 19c3.967 0 7.225-3.097 7.484-7H8.5a.5.5 0 01-.5-.5V4.016z" />
      <path d="M18.5 10h-8a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5c2.27 0 4.405.884 6.01 2.49S19 7.23 19 9.5a.5.5 0 01-.5.5zM11 9h6.984A7.513 7.513 0 0011 2.016V9z" />
    </svg>
  );
}

export default SvgPieChart;
