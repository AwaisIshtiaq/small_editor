import {useCurrentFrame, interpolate} from 'remotion';

const V = '#ec7f37', A = '#FF5A09', N = 90;
const sw = {stroke: V, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round'};

export const WebIll = () => {
  const f = useCurrentFrame();
  const phase = (f / N) * Math.PI * 2;
  const float = Math.sin(phase) * 7;
  return (
    <svg width="400" height="340" viewBox="0 0 400 340">
      {/* cloud */}
      <g transform={`translate(0 ${float})`}>
        <path d="M120 150a38 38 0 010-76 52 52 0 01100-8 40 40 0 0112 84z" fill="rgba(236,127,55,.14)" {...sw} />
        <path d="M150 112h100" stroke={A} strokeWidth="3" strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(phase)} />
      </g>
      {/* data packets rising from the server to the cloud */}
      {[0, 1, 2].map((k) => {
        const t = (f / N + k / 3) % 1;
        const y = interpolate(t, [0, 1], [232, 150]);
        const o = Math.sin(Math.PI * t);
        return <rect key={k} x={[176, 196, 216][k]} y={y} width="8" height="14" rx="3" fill={A} opacity={o} />;
      })}
      {/* server rack */}
      {[0, 1, 2].map((i) => {
        const y = 232 + i * 30;
        const on = Math.sin(phase * 2 + i * 1.6) > 0;
        return (
          <g key={i}>
            <rect x="120" y={y} width="160" height="24" rx="8" fill="rgba(236,127,55,.1)" {...sw} />
            <circle cx="140" cy={y + 12} r="4" fill={on ? A : V} opacity={on ? 1 : 0.35} />
            <path d={`M162 ${y + 12}h70`} {...sw} opacity="0.35" />
          </g>
        );
      })}
    </svg>
  );
};
