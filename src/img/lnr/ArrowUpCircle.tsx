import * as React from "react";

function SvgArrowUpCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M2.782 3.782C.988 5.576 0 7.962 0 10.5s.988 4.923 2.782 6.718S6.962 20 9.5 20s4.923-.988 6.718-2.782S19 13.038 19 10.501s-.988-4.923-2.782-6.718-4.18-2.782-6.718-2.782-4.923.988-6.718 2.782zM18 10.5c0 4.687-3.813 8.5-8.5 8.5S1 15.187 1 10.5C1 5.813 4.813 2 9.5 2S18 5.813 18 10.5z" />
      <path d="M9.147 4.647l-4 4a.5.5 0 00.707.707L9 6.207V16.5a.5.5 0 001 0V6.207l3.147 3.146a.5.5 0 00.706-.706l-4-4a.5.5 0 00-.707 0z" />
    </svg>
  );
}

export default SvgArrowUpCircle;
