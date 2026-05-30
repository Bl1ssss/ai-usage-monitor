type UsageCardProps = {
  title: string;
  main: string;
  sub?: string;
  percent?: number;
  error?: string;
  warning?: boolean;
};

export function UsageCard({
  title,
  main,
  sub,
  percent,
  error,
  warning,
}: UsageCardProps) {
  return (
    <section className={warning ? "card warning-card" : "card"}>
      <div className="card-title">{title}</div>

      <div className={error ? "card-main error-text" : "card-main"}>{main}</div>

      {typeof percent === "number" && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      {error ? (
        <div className="card-sub error-text">{error}</div>
      ) : (
        sub && <div className="card-sub">{sub}</div>
      )}
    </section>
  );
}
