import * as React from "react";

function SvgMenuCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M9.5 20c-2.538 0-4.923-.988-6.718-2.782S0 13.038 0 10.501c0-2.538.988-4.923 2.782-6.718S6.962 1 9.5 1c2.538 0 4.923.988 6.718 2.783S19 7.963 19 10.501s-.988 4.923-2.782 6.717A9.438 9.438 0 019.5 20zm0-18C4.813 2 1 5.813 1 10.5S4.813 19 9.5 19s8.5-3.813 8.5-8.5S14.187 2 9.5 2z" />
      <path d="M14.5 8h-10a.5.5 0 010-1h10a.5.5 0 010 1zM14.5 11h-10a.5.5 0 010-1h10a.5.5 0 010 1zM14.5 14h-10a.5.5 0 010-1h10a.5.5 0 010 1z" />
    </svg>
  );
}

export default SvgMenuCircle;
