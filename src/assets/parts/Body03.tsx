import type { SVGProps } from "react";
const SvgBody03 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 60c50-2 72 24 72 50 0 30-30 52-72 52s-72-22-72-52c0-26 22-48 72-50Z"
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
export default SvgBody03;
