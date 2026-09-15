import { Gauge, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";

export function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (plan: Plan) => void }) {
  return (
    <Card className="surface-panel relative gap-0 overflow-hidden p-5 transition-shadow hover:glow-neon">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">{plan.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" /> {planDurationLabel(plan)}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 font-display">
          {formatKes(plan.price_kes)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Gauge className="size-3.5 text-accent" /> Up to {plan.speed_limit_mbps} Mbps
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="size-3.5 text-accent" />
          {plan.download_limit_mb ? `${plan.download_limit_mb} MB` : "Unlimited data"}
        </span>
      </div>

      <Button className="mt-5 w-full font-display" onClick={() => onSelect(plan)}>
        Buy for {formatKes(plan.price_kes)}
      </Button>
    </Card>
  );
}
