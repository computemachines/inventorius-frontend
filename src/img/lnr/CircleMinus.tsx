import * as React from "react";

function SvgCircleMinus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M16.218 3.782C14.424 1.988 12.038 1 9.5 1s-4.923.988-6.718 2.782S0 7.962 0 10.499s.988 4.923 2.782 6.718 4.18 2.782 6.718 2.782 4.923-.988 6.718-2.782S19 13.037 19 10.499s-.988-4.923-2.782-6.717zM9.5 19C4.813 19 1 15.187 1 10.5S4.813 2 9.5 2c4.687 0 8.5 3.813 8.5 8.5S14.187 19 9.5 19z" />
      <path d="M15.5 11h-12a.5.5 0 010-1h12a.5.5 0 010 1z" />
    </svg>
  );
}

export default SvgCircleMinus;