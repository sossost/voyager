import type { SVGProps } from "react";
const SvgBody02 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 30c34 0 52 28 52 62v58c0 12-10 16-18 8s-12-6-18 2-26 8-32 0-10-10-18-2-18 4-18-8V92c0-34 18-62 52-62Z"
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
export default SvgBody02;
