import type { SVGProps } from "react";
const SvgEyes07 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <circle
      cx={64}
      cy={90}
      r={19}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle
      cx={136}
      cy={90}
      r={19}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle cx={64} cy={90} r={13} fill="var(--alien-secondary)" />
    <circle cx={136} cy={90} r={13} fill="var(--alien-secondary)" />
  </svg>
);
export default SvgEyes07;
