import { sql } from "./auth";

type Kpi = "contatti" | "fissati" | "visti" | "chiusi";
const KPIS: Kpi[] = ["contatti", "fissati", "visti", "chiusi"];

export type CoachingAgent = {
  agent_id: string;
  name: string;
  totals: Record<Kpi, number>;
  lights: Record<Kpi, "green" | "yellow" | "red">;
  conversion: number | null; // chiusi / contatti, in %
  weak_area: string | null;
  weeks: { contatti: number; chiusi: number; conversion: number | null }[]; // dalla piu' vecchia alla piu' recente
};

export type Coaching = {
  team_conversion: number | null;
  agents: CoachingAgent[];
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

// Ultime 4 settimane (28 giorni), confronto di ogni agente con la media del team
export async function computeCoaching(): Promise<Coaching> {
  const rows = await sql`
    SELECT s.agent_id, u.first_name, u.last_name, s.stat_date::text AS d,
           s.contatti, s.fissati, s.visti, s.chiusi
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE s.stat_date > current_date - 28 AND s.stat_date <= current_date AND u.status = 'attivo'`;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const byAgent = new Map<string, { name: string; totals: Record<Kpi, number>; weeks: { contatti: number; chiusi: number }[] }>();
  for (const r of rows) {
    const key = r.agent_id as string;
    if (!byAgent.has(key)) {
      byAgent.set(key, {
        name: r.first_name as string,
        totals: { contatti: 0, fissati: 0, visti: 0, chiusi: 0 },
        weeks: [0, 1, 2, 3].map(() => ({ contatti: 0, chiusi: 0 })),
      });
    }
    const entry = byAgent.get(key)!;
    for (const k of KPIS) entry.totals[k] += Number(r[k]);
    const [y, m, d] = String(r.d).split("-").map(Number);
    const age = Math.floor((todayUtc - Date.UTC(y, m - 1, d)) / 86400000);
    const week = Math.min(3, Math.max(0, Math.floor(age / 7)));
    entry.weeks[3 - week].contatti += Number(r.contatti);
    entry.weeks[3 - week].chiusi += Number(r.chiusi);
  }

  const list = [...byAgent.entries()];
  const n = list.length || 1;
  const teamTotals: Record<Kpi, number> = { contatti: 0, fissati: 0, visti: 0, chiusi: 0 };
  for (const [, e] of list) for (const k of KPIS) teamTotals[k] += e.totals[k];
  const avg = Object.fromEntries(KPIS.map((k) => [k, teamTotals[k] / n])) as Record<Kpi, number>;

  const teamRatios = {
    fissare: teamTotals.contatti > 0 ? teamTotals.fissati / teamTotals.contatti : 0,
    vedere: teamTotals.fissati > 0 ? teamTotals.visti / teamTotals.fissati : 0,
    chiudere: teamTotals.visti > 0 ? teamTotals.chiusi / teamTotals.visti : 0,
  };

  const agents: CoachingAgent[] = list.map(([id, e]) => {
    const lights = Object.fromEntries(
      KPIS.map((k) => {
        const ratio = avg[k] > 0 ? e.totals[k] / avg[k] : 1;
        return [k, ratio >= 0.9 ? "green" : ratio >= 0.6 ? "yellow" : "red"];
      }),
    ) as CoachingAgent["lights"];

    // Fase in cui l'agente e' piu' indietro rispetto al team
    const own = {
      fissare: e.totals.contatti > 0 ? e.totals.fissati / e.totals.contatti : null,
      vedere: e.totals.fissati > 0 ? e.totals.visti / e.totals.fissati : null,
      chiudere: e.totals.visti > 0 ? e.totals.chiusi / e.totals.visti : null,
    };
    const labels = { fissare: "Fissare appuntamenti", vedere: "Portare i fissati a visita", chiudere: "Chiusura" };
    let weak: string | null = null;
    let worst = Infinity;
    if (e.totals.contatti >= 20) {
      for (const key of ["fissare", "vedere", "chiudere"] as const) {
        const mine = own[key];
        const team = teamRatios[key];
        if (mine === null || team <= 0) continue;
        const relative = mine / team;
        if (relative < 0.85 && relative < worst) {
          worst = relative;
          weak = labels[key];
        }
      }
    }

    return {
      agent_id: id,
      name: e.name,
      totals: e.totals,
      lights,
      conversion: pct(e.totals.chiusi, e.totals.contatti),
      weak_area: weak,
      weeks: e.weeks.map((w) => ({ ...w, conversion: pct(w.chiusi, w.contatti) })),
    };
  });

  agents.sort((a, b) => a.name.localeCompare(b.name, "it"));
  return { team_conversion: pct(teamTotals.chiusi, teamTotals.contatti), agents };
}
