import * as React from "react";

function SvgIndentDecrease(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 5h-15a.5.5 0 010-1h15a.5.5 0 010 1zM17.5 8h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 11h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 14h-8a.5.5 0 010-1h8a.5.5 0 010 1zM17.5 17h-15a.5.5 0 010-1h15a.5.5 0 010 1zM6.5 14a.5.5 0 01-.3-.1l-4-3a.5.5 0 010-.8l4-3a.5.5 0 01.8.4v6a.5.5 0 01-.5.5zm-3.167-3.5L6 12.5v-4l-2.667 2z" />
    </svg>
  );
}

export default SvgIndentDecrease;
