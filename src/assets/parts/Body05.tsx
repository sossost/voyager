import type { SVGProps } from "react";
const SvgBody05 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 34c18 26 62 58 62 88s-28 50-62 50-62-20-62-50 44-62 62-88Z"
    />
    <ellipse
      cx={100}
      cy={128}
      fill="var(--alien-accent)"
      opacity={0.25}
      rx={30}
      ry={20}
    />
  </svg>
);
export default SvgBody05;
