import type { SVGProps } from "react";
const SvgBody06 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 40c46 0 68 30 68 56 0 18-14 28-30 30v16c0 18-16 28-38 28s-38-10-38-28v-16c-16-2-30-12-30-30 0-26 22-56 68-56Z"
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
export default SvgBody06;
