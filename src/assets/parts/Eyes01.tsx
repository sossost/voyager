import type { SVGProps } from "react";
const SvgEyes01 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <circle
      cx={70}
      cy={90}
      r={13}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle
      cx={130}
      cy={90}
      r={13}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle cx={70} cy={90} r={7} fill="var(--alien-secondary)" />
    <circle cx={130} cy={90} r={7} fill="var(--alien-secondary)" />
  </svg>
);
export default SvgEyes01;
