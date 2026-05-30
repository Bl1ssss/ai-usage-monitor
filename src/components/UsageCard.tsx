import type { ProviderSnapshot, ProviderSnapshotStatus } from "../types/metrics";

type UsageCardProps = {
  snapshot: ProviderSnapshot;
};

const STATUS_LABELS: Record<ProviderSnapshotStatus, string> = {
  ok: "OK",
  warning: "WARN",
  error: "ERROR",
  stale: "STALE",
  loading: "LOAD",
  mock: "MOCK",
};

export function UsageCard({ snapshot }: UsageCardProps) {
  const { title, main, sub, percent, error, status } = snapshot;
  const cardClassName = `card card-${status}`;
  const hasError = Boolean(error);

  return (
    <section className={cardClassName} data-provider={snapshot.id}>
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="status-badge">{STATUS_LABELS[status]}</div>
      </div>

      <div className={hasError ? "card-main error-text" : "card-main"}>{main}</div>

      {typeof percent === "number" && (
        <div className="progress" aria-label={`${title} usage ${percent.toFixed(1)}%`}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      {hasError ? (
        <div className="card-sub error-text" title={error}>
          {error}
        </div>
      ) : (
        <div className="card-sub">{sub}</div>
      )}
    </section>
  );
}
