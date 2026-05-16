import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label, value, icon: Icon, trend, tone = "primary",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: string; up?: boolean };
  tone?: "primary" | "info" | "warning" | "success";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${trend.up ? "text-success" : "text-destructive"}`}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg p-2 ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
