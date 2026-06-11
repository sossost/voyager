import type { SVGProps } from "react";
const SvgPat02 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-accent)"
      d="m100 98 6 14h15l-12 9 4 15-13-9-13 9 4-15-12-9h15z"
      opacity={0.75}
    />
  </svg>
);
export default SvgPat02;
