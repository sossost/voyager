import type { SVGProps } from "react";
const SvgEyes16 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <circle
      cx={100}
      cy={92}
      r={21}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={4}
    />
    <circle cx={100} cy={92} r={11} fill="var(--alien-secondary)" />
  </svg>
);
export default SvgEyes16;
