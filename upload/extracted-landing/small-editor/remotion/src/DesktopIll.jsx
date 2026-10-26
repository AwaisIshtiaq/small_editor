import {useCurrentFrame, interpolate, spring, useVideoConfig, Easing} from 'remotion';

const V = '#ec7f37', A = '#FF5A09';
const sw = {stroke: V, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round'};

export const DesktopIll = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ease = Easing.bezier(0.32, 0.72, 0, 1);
  const bar = (from, to, w) => interpolate(f, [from, to], [0, w], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const fade = interpolate(f, [0, 6, 80, 89], [0, 1, 1, 0], {extrapolateRight: 'clamp'});
  const hl = bar(38, 58, 130);
  const pop = spring({frame: f - 58, fps, config: {damping: 9, stiffness: 160}});
  const cx = interpolate(f, [0, 40, 64], [250, 150, 230], {extrapolateRight: 'clamp', easing: ease});
  const cy = interpolate(f, [0, 40, 64], [190, 138, 168], {extrapolateRight: 'clamp', easing: ease});
  const sway = Math.sin((f / 90) * Math.PI * 2) * 5;
  return (
    <svg width="400" height="340" viewBox="0 0 400 340">
      {/* monitor */}
      <rect x="70" y="60" width="240" height="160" rx="14" fill="rgba(236,127,55,.1)" {...sw} />
      <path d="M170 220v36M130 258h80" {...sw} />
      <g opacity={fade}>
        <rect x="96" y="86" width={bar(4, 24, 120)} height="9" rx="4.5" fill={V} opacity="0.45" />
        <rect x="96" y="106" width={bar(14, 34, 170)} height="9" rx="4.5" fill={V} opacity="0.3" />
        <rect x="96" y="126" width={hl} height="14" rx="4" fill={A} opacity="0.55" />
        <rect x="96" y="127" width={bar(24, 44, 130)} height="9" rx="4.5" fill={V} opacity="0.5" />
        <rect x="96" y="150" width={bar(30, 50, 150)} height="9" rx="4.5" fill={V} opacity="0.3" />
        <g transform={`translate(262 178) scale(${Math.max(0, pop)})`}>
          <circle r="16" fill={A} />
          <path d="M-7 0l5 5 9-10" stroke="#2a1500" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <path d="M0 0l11 5-5 2-2 5z" fill="#2a1f45" stroke="#fff" strokeWidth="1.2" transform={`translate(${cx} ${cy})`} />
      </g>
      {/* plant */}
      <rect x="328" y="238" width="30" height="22" rx="5" fill="rgba(255,90,9,.22)" stroke={A} strokeWidth="3" />
      <g transform={`rotate(${sway} 343 238)`}>
        <path d="M343 238v-34" stroke={A} strokeWidth="3" strokeLinecap="round" />
        <path d="M343 214c-14-2-18-14-18-14s14-2 18 10zM343 206c12-2 16-14 16-14s-14-2-16 10z" fill="rgba(255,90,9,.35)" stroke={A} strokeWidth="2.5" />
      </g>
    </svg>
  );
};
