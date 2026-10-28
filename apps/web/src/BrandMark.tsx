import React from 'react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <svg
        className="brand-emblem"
        viewBox="0 0 88 64"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M28 10 A20 20 0 1 0 28 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
        />
        <path
          d="M54 50 A20 20 0 1 0 54 10 A20 20 0 0 0 37 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
        />
        <path
          d="M28 10 C40 10 42 50 54 50"
          fill="none"
          stroke="#159a92"
          strokeWidth="8"
        />
        <path
          d="M50 36 L69 55"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="square"
        />
      </svg>
      <span className="brand-text">
        <span className="brand-wordmark">ORQELI</span>
        <span className="brand-submark">EDUCATION</span>
      </span>
    </span>
  );
}
