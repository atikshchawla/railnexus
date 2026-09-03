interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
}

export default function KpiCard({ label, value, subtext }: KpiCardProps) {
  return (
    <div className="bg-surface border border-border-default p-4">
      <p className="text-[12.5px] text-text-secondary mb-1">{label}</p>
      <p className="text-[28px] font-semibold text-text-primary leading-none num">
        {value}
      </p>
      {subtext && (
        <p className="text-[11px] text-text-secondary mt-1.5">{subtext}</p>
      )}
    </div>
  );
}
