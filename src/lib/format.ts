// "2026-10-01" + "07:00:00"  ->  "Oct 1, 2026 · 7:00 AM"
export function formatSession(date: string, time: string) {
  const t = time.length === 5 ? time + ":00" : time;
  const d = new Date(`${date}T${t}`);
  if (isNaN(d.getTime())) return `${date} ${time}`;
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const clock = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${clock}`;
}