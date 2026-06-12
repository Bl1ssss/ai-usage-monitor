import type { UsageProgressSnapshot } from "../types/metrics";

type UsageProgressProps = {
  item: UsageProgressSnapshot;
};

export function UsageProgress({ item }: UsageProgressProps) {
  return (
    <div className="usage-row">
      <div className="usage-row-header">
        <span className="usage-label">{item.label}</span>
        <span className="usage-value">{item.valueText}</span>
      </div>

      <div
        className="usage-progress"
        role="progressbar"
        aria-label={`${item.label} usage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.percent}
      >
        <div className="usage-progress-fill" style={{ width: `${item.percent}%` }} />
      </div>

      {item.resetText && <div className="usage-reset">RESET {item.resetText}</div>}
    </div>
  );
}
