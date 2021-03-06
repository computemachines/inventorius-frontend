import * as React from "react";

function SvgCrop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M19.5 15h-3a.5.5 0 010-1h3a.5.5 0 010 1zM12.5 15h-7a.5.5 0 01-.5-.5v-7a.5.5 0 011 0V14h6.5a.5.5 0 010 1zM5.5 4a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5z" />
      <path d="M14.5 20a.5.5 0 01-.5-.5V6H.5a.5.5 0 010-1h14a.5.5 0 01.5.5v14a.5.5 0 01-.5.5z" />
    </svg>
  );
}

export default SvgCrop;
