import type { ProviderSnapshot, ProviderSnapshotStatus } from "../types/metrics";
import { UsageProgress } from "./UsageProgress";

type ProviderCardProps = {
  snapshot: ProviderSnapshot;
};

const STATUS_LABELS: Record<ProviderSnapshotStatus, string> = {
  ok: "OK",
  warning: "WARN",
  error: "ERROR",
  stale: "STALE",
  loading: "SYNC",
  mock: "SOON",
};

export function ProviderCard({ snapshot }: ProviderCardProps) {
  const { title, main, mainLabel, subtitle, rows, error, status } = snapshot;

  return (
    <section
      className={`provider-card status-${status}`}
      data-provider={snapshot.id}
      aria-label={`${title} ${STATUS_LABELS[status]}`}
    >
      <header className="provider-header">
        <div className="provider-heading">
          <div className="provider-title">{title}</div>
          {mainLabel && <div className="provider-main-label">{mainLabel}</div>}
        </div>

        <span className="provider-status">{STATUS_LABELS[status]}</span>
      </header>

      {main && <div className="provider-main">{main}</div>}
      {subtitle && <div className="provider-subtitle">{subtitle}</div>}

      {rows.length > 0 && (
        <div className="usage-list">
          {rows.map((item) => (
            <UsageProgress key={item.id} item={item} />
          ))}
        </div>
      )}

      {error && (
        <div className="provider-error" title={error}>
          {error}
        </div>
      )}
    </section>
  );
}
