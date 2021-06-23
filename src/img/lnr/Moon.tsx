import * as React from "react";

function SvgMoon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M10.25 20c-2.738 0-5.312-1.066-7.248-3.002S0 12.488 0 9.75c0-2.251.723-4.375 2.09-6.143a10.237 10.237 0 012.331-2.194A10.417 10.417 0 017.359.021a.5.5 0 01.587.708c-.645 1.257-.945 2.455-.945 3.772 0 4.687 3.813 8.5 8.5 8.5 1.317 0 2.515-.3 3.772-.945a.5.5 0 01.708.587 10.445 10.445 0 01-1.392 2.938 10.237 10.237 0 01-2.194 2.331 9.955 9.955 0 01-6.143 2.09zM6.57 1.365C3.196 2.81 1 6.054 1 9.75 1 14.85 5.15 19 10.25 19c3.696 0 6.94-2.197 8.385-5.57A8.833 8.833 0 0115.5 14c-2.538 0-4.923-.988-6.717-2.782S6 7.038 6 4.5c0-1.077.188-2.111.57-3.135z" />
    </svg>
  );
}

export default SvgMoon;
