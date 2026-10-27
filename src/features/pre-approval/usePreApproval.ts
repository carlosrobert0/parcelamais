"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PreApproval } from "@/domain/types";
import { api } from "@/lib/api";
import { preApprovalKey } from "@/lib/query-keys";

const SAFETY_POLLING_MS = 5_000;
const FALLBACK_POLLING_MS = 2_000;

export function usePreApproval(id: string) {
  const queryClient = useQueryClient();
  const [streamClosed, setStreamClosed] = useState(false);

  const query = useQuery({
    queryKey: preApprovalKey(id),
    queryFn: () => api.getPreApproval(id),
    refetchInterval: (current) => {
      if (current.state.data?.status !== "pending") return false;
      return streamClosed ? FALLBACK_POLLING_MS : SAFETY_POLLING_MS;
    },
  });
  const isRunning = query.data?.status === "pending";

  useEffect(() => {
    if (!isRunning || streamClosed) return;

    const events = new EventSource(`/api/pre-approvals/${id}/events`);
    events.addEventListener("snapshot", (event) => {
      const snapshot: PreApproval = JSON.parse(event.data);
      queryClient.setQueryData(preApprovalKey(id), snapshot);
      if (snapshot.status === "completed") events.close();
    });
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) setStreamClosed(true);
    };
    return () => events.close();
  }, [id, isRunning, streamClosed, queryClient]);

  return query;
}
