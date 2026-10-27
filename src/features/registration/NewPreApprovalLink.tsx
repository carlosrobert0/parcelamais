"use client";

import Link from "next/link";
import { clearDraft } from "./draft";

type NewPreApprovalLinkProps = Omit<React.ComponentProps<typeof Link>, "href" | "onClick">;

const opensElsewhere = (event: React.MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

export function NewPreApprovalLink(props: NewPreApprovalLinkProps) {
  return <Link {...props} href="/" onClick={(event) => opensElsewhere(event) || clearDraft()} />;
}
