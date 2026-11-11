export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="skeleton-product-grid" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-product-card" key={index}>
          <SkeletonBlock className="skeleton-product-image" />
          <SkeletonBlock className="skeleton-product-title" />
          <SkeletonBlock className="skeleton-product-price" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 5, columns = 1 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading content">
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-row" key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => (
            <SkeletonBlock key={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="skeleton-detail" role="status" aria-label="Loading page">
      <SkeletonBlock className="skeleton-detail-title" />
      <SkeletonBlock className="skeleton-detail-line" />
      <SkeletonBlock className="skeleton-detail-line short" />
      <SkeletonBlock className="skeleton-detail-panel" />
    </div>
  );
}