import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Shows the first `limit` items of a long list, with a toggle to reveal the rest. */
export function useShowMore<T>(items: T[], limit: number) {
  const [expanded, setExpanded] = useState(false);
  return {
    shown: expanded ? items : items.slice(0, limit),
    hasMore: items.length > limit,
    expanded,
    toggle: () => setExpanded((value) => !value),
  };
}

/** "Voir les 36 équipes" / "Réduire" button paired with useShowMore. */
export function ShowMoreButton({
  expanded,
  total,
  noun,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  /** Plural noun, e.g. "équipes", "paris". */
  noun: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-center">
      <Button variant="outline" size="sm" onClick={onToggle}>
        {expanded ? "Réduire" : `Voir les ${total} ${noun}`}
      </Button>
    </div>
  );
}
