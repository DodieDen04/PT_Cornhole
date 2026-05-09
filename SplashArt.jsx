/**
 * SplashArt
 *
 * The bespoke artwork for the PT splash screen: hand-drawn red PT monogram
 * and an elongated cornhole board with two bags. Designed to be imported
 * into SplashScreen.jsx and sized via the className prop (or wrapper width).
 *
 * The SVG uses an internal viewBox of 200x300, so it scales cleanly.
 * The component takes no required props.
 */

export default function SplashArt({ className = '' }) {
  return (
    <svg
      viewBox="0 0 200 300"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="PT cornhole logo"
    >
      {/* PT monogram, wobbly comic-style, red with black outline */}
      <g>
        {/* P, tilted left */}
        <g transform="translate(30, 10) rotate(-6, 30, 65)">
          <path
            d="M 1 5 Q 0 0 6 0 L 18 1 L 32 0 L 45 1 Q 62 1 61 30 Q 62 58 41 57 L 22 58 L 21 88 L 22 124 Q 22 131 14 131 L 5 130 Q -1 130 1 122 L 0 80 L 1 40 Z M 22 14 L 33 13 L 38 14 Q 49 14 48 30 Q 49 44 38 44 L 22 44 Z"
            fillRule="evenodd"
            fill="#DC2127"
            stroke="#000000"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Marker-shine highlight */}
          <path
            d="M 4 8 Q 8 4 18 4 L 30 5"
            fill="none"
            stroke="#FAEEDA"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>

        {/* T, tilted right, sits 4px lower than P */}
        <g transform="translate(110, 14) rotate(5, 30, 65)">
          <path
            d="M 4 0 L 30 1 L 56 0 Q 61 0 60 5 L 62 17 Q 60 23 54 22 L 39 22 L 38 80 L 38 124 Q 38 131 30 131 L 24 131 Q 17 131 18 124 L 19 60 L 19 22 L 6 22 Q -1 22 1 15 L 0 5 Q 0 0 4 0 Z"
            fill="#DC2127"
            stroke="#000000"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Marker-shine highlight */}
          <path
            d="M 8 5 L 30 4 L 50 5"
            fill="none"
            stroke="#FAEEDA"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
      </g>

      {/* Cornhole board with two bags */}
      <g transform="translate(100, 240)">
        {/* Ground shadow under the board */}
        <ellipse cx="0" cy="36" rx="60" ry="5" fill="#000000" opacity="0.35" />

        {/* Board surface, elongated trapezoid in 3/4 perspective */}
        <path
          d="M -56 28 L 56 28 L 40 -52 L -40 -52 Z"
          fill="#D4B58F"
          stroke="#FAEEDA"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* Wood grain hint */}
        <line x1="-40" y1="-52" x2="-56" y2="28" stroke="#8B7053" strokeWidth="0.6" opacity="0.45" />
        <line x1="40" y1="-52" x2="56" y2="28" stroke="#8B7053" strokeWidth="0.6" opacity="0.45" />
        <line x1="-12" y1="-52" x2="-22" y2="28" stroke="#A88B6A" strokeWidth="0.4" opacity="0.3" />
        <line x1="12" y1="-52" x2="22" y2="28" stroke="#A88B6A" strokeWidth="0.4" opacity="0.3" />

        {/* Hole, near the back of the board (regulation position) */}
        <ellipse cx="0" cy="-36" rx="10" ry="4" fill="#042C53" />
        <ellipse cx="0" cy="-37" rx="10" ry="4" fill="none" stroke="#3a2a18" strokeWidth="0.8" opacity="0.6" />

        {/* Red bag, foreground */}
        <g transform="translate(-20, 12) rotate(-12)">
          <rect x="-11" y="-6" width="22" height="13" rx="3" fill="#C04025" />
          <rect x="-11" y="-6" width="22" height="13" rx="3" fill="none" stroke="#5a1d12" strokeWidth="0.6" />
        </g>

        {/* Blue bag, mid-board */}
        <g transform="translate(12, -8) rotate(8)">
          <rect x="-10" y="-5" width="20" height="12" rx="2.5" fill="#1E3A8A" />
          <rect x="-10" y="-5" width="20" height="12" rx="2.5" fill="none" stroke="#0c1d4a" strokeWidth="0.6" />
        </g>
      </g>
    </svg>
  );
}
