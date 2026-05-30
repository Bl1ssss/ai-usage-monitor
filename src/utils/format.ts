export function formatCurrency(currency: string, amount: number) {
  if (currency === "CNY") return `¥${amount.toFixed(2)}`;
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatTime(value?: string | null) {
  if (!value) return "never";

  const date = new Date(value);

  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(1)}%`;
}

export function clampPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return Math.max(0, Math.min(100, value));
}

export function formatWindowMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";

  if (value % 10080 === 0) {
    return `${value / 10080}w`;
  }

  if (value % 1440 === 0) {
    return `${value / 1440}d`;
  }

  if (value % 60 === 0) {
    return `${value / 60}h`;
  }

  return `${value}m`;
}
