import type { SVGProps } from "react";
const SvgApp09 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <path
      stroke="var(--alien-secondary)"
      strokeLinecap="round"
      strokeWidth={5}
      d="m81 52-8-30M119 52l8-30"
    />
    <circle cx={73} cy={20} r={8} fill="var(--alien-accent)" />
    <circle cx={127} cy={20} r={8} fill="var(--alien-accent)" />
  </svg>
);
export default SvgApp09;
