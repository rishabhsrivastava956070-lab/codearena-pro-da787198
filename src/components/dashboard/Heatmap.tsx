import { useMemo } from "react";

type Day = { date: string; count: number };

export const Heatmap = ({ data }: { data: Day[] }) => {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(d.date, d.count));
    return m;
  }, [data]);

  const today = new Date();
  const days: Date[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  // group into weeks (53 cols)
  const weeks: Date[][] = [];
  // start by padding so first column starts on Sunday
  const firstDay = days[0].getDay();
  for (let i = 0; i < firstDay; i++) days.unshift(new Date(days[0].getTime() - 86400000));
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const level = (count: number) => {
    if (count === 0) return "bg-secondary/60";
    if (count < 2) return "bg-success/30";
    if (count < 5) return "bg-success/50";
    if (count < 10) return "bg-success/70";
    return "bg-success";
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {w.map((d, di) => {
              const key = d.toISOString().slice(0, 10);
              const c = map.get(key) || 0;
              return (
                <div
                  key={di}
                  className={`h-3 w-3 rounded-sm ${level(c)}`}
                  title={`${key}: ${c} submission${c === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};