import type { SVGProps } from "react";
const SvgApp06 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      stroke="var(--alien-secondary)"
      strokeLinecap="round"
      strokeWidth={5}
      d="m76 52-8-30M124 52l8-30"
    />
    <circle cx={68} cy={20} r={8} fill="var(--alien-accent)" />
    <circle cx={132} cy={20} r={8} fill="var(--alien-accent)" />
  </svg>
);
export default SvgApp06;
