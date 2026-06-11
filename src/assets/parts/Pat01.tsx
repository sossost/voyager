import type { SVGProps } from "react";
const SvgPat01 = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" {...props}>
    <rect
      width={72}
      height={7}
      x={64}
      y={106}
      fill="var(--alien-accent)"
      opacity={0.6}
      rx={3.5}
    />
    <rect
      width={72}
      height={7}
      x={64}
      y={124}
      fill="var(--alien-accent)"
      opacity={0.6}
      rx={3.5}
    />
  </svg>
);
export default SvgPat01;
