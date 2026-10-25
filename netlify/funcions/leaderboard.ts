import { json, requireUser, route, sql } from "./_shared/auth";

// Classifica giornaliera e settimanale (lunedi' - oggi, ora italiana): chi ha fatto piu' contratti
// e chi ha la percentuale di chiusura piu' alta (contratti conclusi / incontri).
export const handler = route("GET", async (event) => {
  const auth = await requireUser(event, ["stats.leaderboard", "stats.view_all"]);
  if ("response" in auth) return auth.response;

  const period = event.queryStringParameters?.period === "week" ? "week" : "day";

  const rows = await sql`
    SELECT s.agent_id, u.first_name, u.last_name,
           sum(s.chiusi)::int AS chiusi, sum(s.visti)::int AS visti,
           sum(s.fissati)::int AS fissati, sum(s.contatti)::int AS contatti
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE u.status = 'attivo'
      AND s.stat_date >= CASE WHEN ${period} = 'week'
                              THEN date_trunc('week', now() AT TIME ZONE 'Europe/Rome')::date
                              ELSE (now() AT TIME ZONE 'Europe/Rome')::date END
      AND s.stat_date <= (now() AT TIME ZONE 'Europe/Rome')::date
    GROUP BY s.agent_id, u.first_name, u.last_name`;

  const list = rows.map((r) => {
    const visti = Number(r.visti);
    const chiusi = Number(r.chiusi);
    return {
      agent_id: r.agent_id as string,
      name: `${r.first_name} ${r.last_name}`,
      chiusi,
      visti,
      fissati: Number(r.fissati),
      contatti: Number(r.contatti),
      rate: visti > 0 ? Math.round((chiusi / visti) * 1000) / 10 : 0,
    };
  });

  const byContracts = [...list].filter((r) => r.chiusi > 0).sort((a, b) => b.chiusi - a.chiusi || b.rate - a.rate).slice(0, 10);
  const byRate = [...list].filter((r) => r.visti > 0).sort((a, b) => b.rate - a.rate || b.chiusi - a.chiusi || b.visti - a.visti).slice(0, 10);

  return json(200, { period, by_contracts: byContracts, by_rate: byRate, agents: list.length });
});
