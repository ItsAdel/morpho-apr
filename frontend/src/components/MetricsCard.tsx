interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  status?: "success" | "warning" | "error" | "info";
}

export function MetricsCard({
  title,
  value,
  icon,
  subtitle,
  status = "info",
}: MetricsCardProps) {
  return (
    <div className={`metrics-card ${status}`}>
      <div className="metrics-card-content">
        <div>
          <p className="metrics-card-title">{title}</p>
          <p className="metrics-card-value">{value}</p>
          {subtitle && <p className="metrics-card-subtitle">{subtitle}</p>}
        </div>
        <div className="metrics-card-icon">{icon}</div>
      </div>
    </div>
  );
}
