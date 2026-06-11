import type { SVGProps } from "react";
const SvgBody08 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 36c12 20 44 48 62 66q12 12 0 24c-18 16-50 32-62 46-12-14-44-30-62-46q-12-12 0-24c18-18 50-46 62-66Z"
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
export default SvgBody08;
