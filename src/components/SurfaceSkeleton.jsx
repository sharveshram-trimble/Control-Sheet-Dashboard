import React from 'react';

/** Immediate first-paint placeholder — never a blank main surface. */
export default function SurfaceSkeleton({ label = 'Loading control sheet…' }) {
  return (
    <div className="surface-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div className="surface-skeleton-rail" aria-hidden="true">
        <div className="sk-block sk-radial" />
        <div className="sk-copy">
          <div className="sk-line sk-w-24" />
          <div className="sk-line sk-w-48" />
          <div className="sk-line sk-w-36" />
        </div>
        <div className="sk-metrics">
          <div className="sk-block sk-metric" />
          <div className="sk-block sk-metric" />
          <div className="sk-block sk-metric" />
          <div className="sk-block sk-metric" />
        </div>
      </div>
      <div className="surface-skeleton-body" aria-hidden="true">
        <div className="sk-line sk-w-32" />
        <div className="sk-block sk-panel" />
        <div className="sk-block sk-panel" />
      </div>
    </div>
  );
}
