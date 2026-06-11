import type { SVGProps } from "react";
const SvgApp03 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      stroke="var(--alien-secondary)"
      strokeLinecap="round"
      strokeWidth={5}
      d="m71 52-8-30M129 52l8-30"
    />
    <circle cx={63} cy={20} r={8} fill="var(--alien-accent)" />
    <circle cx={137} cy={20} r={8} fill="var(--alien-accent)" />
  </svg>
);
export default SvgApp03;
