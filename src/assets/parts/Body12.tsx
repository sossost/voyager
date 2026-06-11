import type { SVGProps } from "react";
const SvgBody12 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      fill="var(--alien-primary)"
      stroke="var(--alien-secondary)"
      strokeLinejoin="round"
      strokeWidth={5}
      d="M100 38c12 0 18 12 26 18 10 6 26 4 32 16s-4 24-4 36c0 14 12 26 4 38s-24 8-34 14-14 14-24 14-14-8-24-14-26-2-34-14 4-24 4-38c0-12-10-24-4-36s22-10 32-16c8-6 14-18 26-18Z"
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
export default SvgBody12;
