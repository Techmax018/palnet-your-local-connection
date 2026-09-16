import { Gauge, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";

export function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (plan: Plan) => void }) {
  return (
    <Card
      className="surface-panel relative overflow-hidden p-3 transition-shadow hover:glow-neon cursor-pointer gap-0"
      onClick={() => onSelect(plan)}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />

      {/* Price badge — prominent */}
      <div className="flex items-start justify-between gap-1">
        <p className="font-display text-xl font-black text-gradient-brand leading-none">
          {formatKes(plan.price_kes)}
        </p>
        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <Gauge className="size-3 text-accent" />
          {plan.speed_limit_mbps}M
        </span>
      </div>

      {/* Name */}
      <p className="mt-1.5 text-xs font-semibold text-foreground leading-snug line-clamp-2">
        {plan.name}
      </p>

      {/* Duration */}
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" />
        {planDurationLabel(plan)}
      </p>

      {/* CTA */}
      <Button
        size="sm"
        className="mt-3 w-full font-display text-xs h-7"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(plan);
        }}
      >
        Buy
      </Button>
    </Card>
  );
}
