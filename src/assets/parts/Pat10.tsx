import type { SVGProps } from "react";
const SvgPat10 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <circle cx={78} cy={112} r={6} fill="var(--alien-accent)" opacity={0.65} />
    <circle cx={100} cy={126} r={6} fill="var(--alien-accent)" opacity={0.65} />
    <circle cx={122} cy={112} r={6} fill="var(--alien-accent)" opacity={0.65} />
  </svg>
);
export default SvgPat10;
