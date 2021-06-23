import * as React from "react";

function SvgPoop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.057 13.303a5.947 5.947 0 00-.239-.129c.955-.749 1.181-1.568 1.181-2.174 0-1.419-1.193-2.655-3.175-3.409A3.504 3.504 0 0011.499 3c-.684 0-1.5-.173-1.5-1 0-.453.578-.948.779-1.085A.5.5 0 0010.5 0C8.933 0 7.322.515 6.082 1.413c-.633.458-1.135.988-1.493 1.575C4.198 3.629 4 4.306 4 5c0 .288.024.574.07.855-.849.41-1.566.951-2.09 1.581C1.339 8.206 1 9.093 1 10c0 .546.123 1.103.356 1.641C.468 12.495 0 13.477 0 14.5c0 1.525 1.028 2.936 2.893 3.973C4.666 19.458 7.012 20 9.5 20c2.558 0 4.879-.333 6.535-.937C18.485 18.17 19 16.904 19 16c0-.728-.337-1.787-1.943-2.697zm-1.364 4.821c-1.55.565-3.749.876-6.193.876-2.32 0-4.494-.498-6.121-1.402C1.845 16.746 1 15.645 1 14.5c0-.797.41-1.461.867-1.952.115.164.24.324.377.479.796.909 1.904 1.603 3.118 1.953a.5.5 0 10.277-.96C3.565 13.421 2 11.693 2 10c0-1.224.88-2.399 2.329-3.155.524 1.443 1.63 2.641 3.004 3.127a.499.499 0 10.333-.942c-1.52-.537-2.667-2.269-2.667-4.029 0-1.012.592-1.998 1.668-2.777a6.583 6.583 0 012.578-1.1 1.8 1.8 0 00-.246.877c0 .967.657 2 2.5 2a2.503 2.503 0 012.375 3.284 12.5 12.5 0 00-1.295-.277.5.5 0 00-.159.987c1.387.223 2.563.647 3.401 1.226.538.372 1.179.982 1.179 1.78 0 .645-.428 1.218-1.273 1.705-.915-.325-1.986-.564-3.169-.702a.5.5 0 10-.116.994c1.686.197 3.112.604 4.122 1.176.655.371 1.436.989 1.436 1.827 0 1.06-1.255 1.74-2.307 2.124z" />
    </svg>
  );
}

export default SvgPoop;
