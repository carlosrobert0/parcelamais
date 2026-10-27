import { CircleCheck, CircleX, CloudOff, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL, formatPercent, formatSeconds } from "@/domain/format";
import type { LenderResult } from "@/domain/types";
import { reasonMessage, STATUS_LABELS } from "./lender-status";

const STATUS_STYLES = {
  pending: { icon: LoaderCircle, color: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  approved: { icon: CircleCheck, color: "text-emerald-600", badge: "bg-emerald-600 text-white" },
  declined: { icon: CircleX, color: "text-destructive", badge: "bg-destructive/10 text-destructive" },
  unavailable: { icon: CloudOff, color: "text-amber-600", badge: "bg-amber-100 text-amber-800" },
} as const;

interface LenderCardProps {
  result: LenderResult;
}

export function LenderCard({ result }: LenderCardProps) {
  const { icon: Icon, color, badge } = STATUS_STYLES[result.status];
  const reason = reasonMessage(result);

  return (
    <Card size="sm" data-testid={`lender-${result.lenderId}`} data-status={result.status}>
      <CardContent className="flex items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", color, result.status === "pending" && "animate-spin")} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{result.lenderName}</span>
            <Badge className={badge}>{STATUS_LABELS[result.status]}</Badge>
          </div>
          {result.status === "approved" && (
            <p className="text-sm text-muted-foreground">
              {formatBRL(result.approvedAmountCents!)} · {formatPercent(result.monthlyRate!)} a.m. · {result.terms!.join(", ")} meses
            </p>
          )}
          {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
          {result.latencyMs !== null && result.status !== "unavailable" && (
            <p className="text-xs text-muted-foreground">Respondeu em {formatSeconds(result.latencyMs)} s</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
