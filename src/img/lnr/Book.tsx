import * as React from "react";

function SvgBook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14.5 18h-10a.5.5 0 010-1h10a.5.5 0 010 1z" />
      <path d="M16.5 3a.5.5 0 00-.5.5v15a.5.5 0 01-.5.5h-11c-.827 0-1.5-.673-1.5-1.5S3.673 16 4.5 16h9c.827 0 1.5-.673 1.5-1.5v-12c0-.827-.673-1.5-1.5-1.5h-10C2.673 1 2 1.673 2 2.5v15C2 18.878 3.122 20 4.5 20h11c.827 0 1.5-.673 1.5-1.5v-15a.5.5 0 00-.5-.5zm-13-1h10a.5.5 0 01.5.5v12a.5.5 0 01-.5.5h-9c-.562 0-1.082.187-1.5.501V2.5a.5.5 0 01.5-.5z" />
    </svg>
  );
}

export default SvgBook;