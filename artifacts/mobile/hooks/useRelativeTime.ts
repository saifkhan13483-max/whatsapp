import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export function useRelativeTime(date: Date | string | number | null | undefined): string {
  const [label, setLabel] = useState(() => {
    if (!date) return "Unknown";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  });

  useEffect(() => {
    if (!date) {
      setLabel("Unknown");
      return;
    }

    function update() {
      try {
        setLabel(formatDistanceToNow(new Date(date!), { addSuffix: true }));
      } catch {
        setLabel("Unknown");
      }
    }

    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [date]);

  return label;
}
