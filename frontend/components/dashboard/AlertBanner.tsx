import { AlertTriangle, Info } from "lucide-react";

interface AlertBannerProps {
  message: string;
  type?: "critical" | "warning" | "info";
}

export default function AlertBanner({ message, type = "warning" }: AlertBannerProps) {
  if (type === "critical") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-critical text-white text-[13px] font-medium">
        <AlertTriangle size={15} strokeWidth={2} />
        {message}
      </div>
    );
  }

  if (type === "warning") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning-bg text-warning text-[13px] font-medium border border-warning/20">
        <AlertTriangle size={15} strokeWidth={2} />
        {message}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-info/5 text-info text-[13px] font-medium border border-info/20">
      <Info size={15} strokeWidth={2} />
      {message}
    </div>
  );
}
