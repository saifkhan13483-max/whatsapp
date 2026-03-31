import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export function formatRelativeTime(date: Date | string | number): string {
  try {
    const d = new Date(date);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function formatTimeLabel(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "";
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function formatDateRange(range: "today" | "week" | "month"): string {
  const now = new Date();
  if (range === "today") return format(now, "MMM d, yyyy");
  if (range === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return `${format(start, "MMM d")} - ${format(now, "MMM d")}`;
  }
  return format(now, "MMMM yyyy");
}
