"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { DEADLINE_MS } from "@/domain/deadline";

const TICK_MS = 250;

interface CountdownProps {
  deadlineAt: string;
}

export function Countdown({ deadlineAt }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, Date.parse(deadlineAt) - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {remainingSeconds > 0 ? `Aguardando respostas · no máximo ${remainingSeconds} s` : "Encerrando…"}
      </p>
      <Progress value={100 - (remainingMs / DEADLINE_MS) * 100} aria-label="Tempo de espera" />
    </div>
  );
}
