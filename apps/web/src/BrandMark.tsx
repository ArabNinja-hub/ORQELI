import React from 'react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <svg
        className="brand-emblem"
        viewBox="0 0 304 184"
        aria-hidden="true"
        focusable="false"
      >
        {/* Left O ring — deep navy */}
        <path
          d="M 88 10 A 78 78 0 1 0 142.44 143.86 A 90 90 0 0 1 126.94 114.32 A 47 47 0 1 1 88 41 Z"
          fill="currentColor"
        />
        {/* Interlocking S-ribbon upper arc — bright teal */}
        <path
          d="M 88 10 A 78 78 0 0 1 166 88.5 L 135 88.5 A 47 47 0 0 0 88 41 Z"
          fill="#1ca89b"
        />
        {/* Interlocking S-ribbon lower arc — deep teal */}
        <path
          d="M 135 88 A 78 78 0 0 0 213.5 166 L 213.5 135 A 47 47 0 0 1 166 88 Z"
          fill="#15797b"
        />
        {/* Right Q ring upper-right arc — deep navy */}
        <path
          d="M 158.56 32.14 A 78 78 0 0 1 269.31 141.97 L 247.69 119.71 A 47 47 0 1 0 174.06 61.68 A 90 90 0 0 0 158.56 32.14 Z"
          fill="currentColor"
        />
        {/* Right Q bottom connector wedge & geometric Q tail — deep navy */}
        <path
          d="M 213 135 A 47 47 0 0 0 225 133.44 L 245 159.17 A 78 78 0 0 1 213 166 Z"
          fill="currentColor"
        />
        <path
          d="M 177 101 L 216 101 L 285 172 L 246 172 Z"
          fill="currentColor"
        />
      </svg>
      <span className="brand-text">
        <span className="brand-wordmark">ORQELI</span>
        <span className="brand-submark">EDUCATION</span>
      </span>
    </span>
  );
}
