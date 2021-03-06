import * as React from "react";

function SvgApartment(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M14 6h1v1h-1V6zM14 8h1v1h-1V8zM14 10h1v1h-1v-1zM14 12h1v1h-1v-1zM14 16h1v1h-1v-1zM14 14h1v1h-1v-1zM6 6h1v1H6V6zM6 8h1v1H6V8zM6 10h1v1H6v-1zM6 12h1v1H6v-1zM6 16h1v1H6v-1zM6 14h1v1H6v-1zM4 6h1v1H4V6zM4 8h1v1H4V8zM4 10h1v1H4v-1zM4 12h1v1H4v-1zM4 16h1v1H4v-1zM4 14h1v1H4v-1zM8 6h1v1H8V6zM8 8h1v1H8V8zM8 10h1v1H8v-1zM8 12h1v1H8v-1zM8 16h1v1H8v-1zM8 14h1v1H8v-1z" />
      <path d="M18.5 19H18V5.5c0-.763-.567-1.549-1.291-1.791L12 2.139V.499a.5.5 0 00-.644-.479L2.314 2.733C1.577 2.954 1 3.73 1 4.499v14.5H.5a.5.5 0 000 1h18a.5.5 0 000-1zM16.393 4.658c.318.106.607.507.607.842V19h-5V3.194l4.393 1.464zM2 4.5c0-.329.287-.714.602-.808L11 1.172V19H2V4.5z" />
    </svg>
  );
}

export default SvgApartment;
