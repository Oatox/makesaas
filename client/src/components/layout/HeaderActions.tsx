import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SLOT_ID = "app-header-actions";

/** Empty slot on the right of the app header; pages fill it with <HeaderActions>. */
export function HeaderActionsSlot() {
  return <div id={SLOT_ID} className="ml-auto flex shrink-0 items-center gap-2" />;
}

/** Renders its children in the app header, top right (the slot lives in AppLayout). */
export function HeaderActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => setSlot(document.getElementById(SLOT_ID)), []);

  return slot ? createPortal(children, slot) : null;
}
