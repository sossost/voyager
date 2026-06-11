import type { SVGProps } from "react";
const SvgEyes14 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <circle
      cx={52}
      cy={90}
      r={16}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle
      cx={148}
      cy={90}
      r={16}
      fill="#fff"
      stroke="var(--alien-secondary)"
      strokeWidth={3}
    />
    <circle cx={52} cy={90} r={10} fill="var(--alien-accent)" />
    <circle cx={148} cy={90} r={10} fill="var(--alien-accent)" />
  </svg>
);
export default SvgEyes14;
