/**
 * PTLogo
 *
 * Just the PT monogram, copied from SplashArt.jsx so the source asset isn't modified.
 * ViewBox is tightened to frame the P and T glyphs (with a touch of padding for strokes).
 * Size via the className prop, e.g. <PTLogo className="h-8" />.
 */
export default function PTLogo({ className = '' }) {
  return (
    <svg
      viewBox="25 5 152 145"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="PT"
    >
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
        <path
          d="M 4 8 Q 8 4 18 4 L 30 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
      <g transform="translate(110, 14) rotate(5, 30, 65)">
        <path
          d="M 4 0 L 30 1 L 56 0 Q 61 0 60 5 L 62 17 Q 60 23 54 22 L 39 22 L 38 80 L 38 124 Q 38 131 30 131 L 24 131 Q 17 131 18 124 L 19 60 L 19 22 L 6 22 Q -1 22 1 15 L 0 5 Q 0 0 4 0 Z"
          fill="#DC2127"
          stroke="#000000"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M 8 5 L 30 4 L 50 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}
