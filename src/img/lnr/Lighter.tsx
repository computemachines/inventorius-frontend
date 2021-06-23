import * as React from "react";

function SvgLighter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} {...props}>
      <path d="M17.5 9h-.69l-.855-1.722A.5.5 0 0015.507 7H11.5a.5.5 0 00-.5.5V9H9.789L5.933 2.322a.5.5 0 00-.683-.183l-3.464 2a.5.5 0 00-.183.683l4 6.928a.501.501 0 00.683.183L9 10.366V18.5a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5zm-.5 6h-1v-3h1v3zm-5-7h3.197l.497 1H12V8zm-5.781 2.817l-3.5-6.062 2.598-1.5 3.5 6.062-2.598 1.5zM10 18v-8H17v1h-1.5a.5.5 0 00-.5.5v4a.5.5 0 00.5.5H17v2h-7zM15.5 6c-.75 0-1.115-.354-1.289-.652-.331-.565-.275-1.418.169-2.606.299-.799.668-1.459.684-1.487a.501.501 0 01.872 0c.016.028.385.688.684 1.487.444 1.189.5 2.041.169 2.606-.174.297-.539.652-1.289.652zm0-3.36a9.893 9.893 0 00-.187.463c-.453 1.218-.297 1.64-.238 1.741.025.043.092.156.425.156s.401-.114.426-.156c.059-.101.216-.525-.243-1.751a9.47 9.47 0 00-.183-.453z" />
    </svg>
  );
}

export default SvgLighter;
