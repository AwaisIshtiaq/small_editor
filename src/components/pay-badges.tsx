// Payment-method badges (PayPal, Mastercard, VISA, AMEX) as inline SVG per
// the reference shot: classic brand colors, no image assets, theme-proof.

const SHELL = { strokeLinejoin: 'round' as const }

function PayPal() {
  return (
    <svg viewBox="0 0 92 34" aria-label="PayPal" role="img">
      <defs>
        <linearGradient id="pb-pp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="1" stopColor="#d6d6d3" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="91" height="33" rx="5" fill="url(#pb-pp)" stroke="#adadaa" {...SHELL} />
      <text
        x="46"
        y="22.5"
        textAnchor="middle"
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="14"
        fontWeight="700"
        fontStyle="italic"
      >
        <tspan fill="#003087">Pay</tspan>
        <tspan fill="#009cde">Pal</tspan>
      </text>
    </svg>
  )
}

function Mastercard() {
  return (
    <svg viewBox="0 0 96 34" aria-label="Mastercard" role="img">
      <rect x="0.5" y="0.5" width="95" height="33" rx="5" fill="#f7f5f0" stroke="#b3b3b0" {...SHELL} />
      {/* interlocking circles: red under, orange overlaid */}
      <circle cx="41.5" cy="13" r="8.2" fill="#d9222a" />
      <circle cx="51.5" cy="13" r="8.2" fill="#f79e1b" fillOpacity="0.9" />
      <path d="M46.5 6.7a8.2 8.2 0 010 12.6 8.2 8.2 0 010-12.6z" fill="#ed6a0c" opacity="0.9" />
      {/* navy name band across the bottom */}
      <path d="M0.5 21h95v8a4.5 4.5 0 01-4.5 4.5H5A4.5 4.5 0 010.5 29z" fill="#1b3a92" />
      <text
        x="48"
        y="29.6"
        textAnchor="middle"
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="8.2"
        fontWeight="700"
        fontStyle="italic"
        fill="#ffffff"
      >
        MasterCard
      </text>
    </svg>
  )
}

function Visa() {
  return (
    <svg viewBox="0 0 88 34" aria-label="VISA" role="img">
      <rect x="0.5" y="0.5" width="87" height="33" rx="5" fill="#ffffff" stroke="#c3c3c0" {...SHELL} />
      <text
        x="44"
        y="23.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="16.5"
        fontWeight="700"
        fontStyle="italic"
        letterSpacing="1"
        fill="#1a1f71"
      >
        VISA
      </text>
      <path d="M14 27.5h22" stroke="#f7b600" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function Amex() {
  return (
    <svg viewBox="0 0 96 34" aria-label="American Express" role="img">
      <rect x="0.5" y="0.5" width="95" height="33" rx="5" fill="#2e77bc" stroke="#255ea3" {...SHELL} />
      <text
        x="48"
        y="15.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.6"
        fontWeight="700"
        letterSpacing="0.6"
        fill="#ffffff"
      >
        AMERICAN
      </text>
      <text
        x="48"
        y="26.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.6"
        fontWeight="700"
        letterSpacing="0.6"
        fill="#ffffff"
      >
        EXPRESS
      </text>
    </svg>
  )
}

export default function PayBadges() {
  return (
    <>
      <span className="pb" title="PayPal">
        <PayPal />
      </span>
      <span className="pb" title="Mastercard">
        <Mastercard />
      </span>
      <span className="pb" title="VISA">
        <Visa />
      </span>
      <span className="pb" title="American Express">
        <Amex />
      </span>
    </>
  )
}
