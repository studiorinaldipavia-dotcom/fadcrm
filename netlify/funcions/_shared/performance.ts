// Criticita' di ogni agente rispetto alla media degli ALTRI agenti nello stesso periodo.
// I numeri arrivano dalla vista agent_stats_combined (automatici da LeadHub + inseriti a mano).

export type Totals = {
  chiamate: number;
  contatti: number;
  fissati: number;
  visti: number;
  chiusi: number;
  con_trattativa: number;
  senza_trattativa: number;
  giorni: number;
};

export type Insight = {
  level: "red" | "yellow" | "green";
  area: string; // area di formazione
  title: string;
  text: string;
};

const LOW = 0.65; // sotto il 65% della media degli altri = "molto meno"
const VERY_LOW = 0.4;

const level = (ratio: number): "red" | "yellow" => (ratio < VERY_LOW ? "red" : "yellow");
const pct = (ratio: number) => Math.round((1 - ratio) * 100);
const f1 = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const f0 = (n: number) => Math.round(n * 100) / 100;

export function buildInsights(me: Totals, peersAll: Totals[]): Insight[] {
  const peers = peersAll.filter((p) => p.giorni > 0);
  if (me.giorni === 0) {
    return [{ level: "yellow", area: "Dati", title: "Nessun dato nel periodo", text: "Non ci sono ancora numeri per questo periodo: appena chiami dal Call Mode compaiono qui da soli." }];
  }
  if (peers.length < 2) {
    return [{ level: "yellow", area: "Dati", title: "Confronto non ancora possibile", text: "Servono i numeri di almeno altri due agenti nel periodo per confrontarti con la media." }];
  }

  const perDay = (t: Totals, k: keyof Totals) => (t[k] as number) / Math.max(t.giorni, 1);
  const mean = (k: keyof Totals) => peers.reduce((s, p) => s + perDay(p, k), 0) / peers.length;
  const pooled = (num: keyof Totals, den: keyof Totals) => {
    const n = peers.reduce((s, p) => s + (p[num] as number), 0);
    const d = peers.reduce((s, p) => s + (p[den] as number), 0);
    return d > 0 ? n / d : null;
  };
  const rate = (num: number, den: number) => (den > 0 ? num / den : null);

  const out: Insight[] = [];

  // 1) Chiamate: chiami poco
  const callsMe = perDay(me, "chiamate");
  const callsAvg = mean("chiamate");
  const lowCalls = callsAvg >= 5 && callsMe < callsAvg * LOW;
  if (lowCalls) {
    out.push({
      level: level(callsMe / callsAvg),
      area: "Ritmo di chiamata",
      title: "Chiami poco",
      text: `Fai circa ${f1(callsMe)} chiamate al giorno, il ${pct(callsMe / callsAvg)}% in meno della media degli altri agenti (${f1(callsAvg)}). Formazione: organizzazione del tempo e blocchi di chiamata senza pause lunghe.`,
    });
  }

  // 2) Contatti: parli con poche persone
  const contMe = perDay(me, "contatti");
  const contAvg = mean("contatti");
  if (contAvg >= 2 && contMe < contAvg * LOW) {
    out.push({
      level: level(contMe / contAvg),
      area: "Apertura della telefonata",
      title: "Parli con poche persone",
      text: `Hai circa ${f1(contMe)} contatti al giorno contro ${f1(contAvg)} degli altri agenti (${pct(contMe / contAvg)}% in meno). ${
        lowCalls ? "Anche le chiamate sono poche: parti da lì." : "Chiami abbastanza ma le chiamate non diventano conversazioni."
      } Formazione: apertura della telefonata, tono e orari migliori per trovare le persone.`,
    });
  }

  // 3) Appuntamenti fissati sui contatti
  const setMe = rate(me.fissati, me.contatti);
  const setAvg = pooled("fissati", "contatti");
  if (setMe !== null && setAvg && me.contatti >= 10 && setMe < setAvg * LOW) {
    out.push({
      level: level(setMe / setAvg),
      area: "Proposta dell'appuntamento",
      title: "Fissi pochi appuntamenti rispetto ai contatti",
      text: `Fissi un appuntamento ogni ${f1(1 / setMe)} contatti, gli altri ogni ${f1(1 / setAvg)}. Formazione: come proporre l'incontro e gestire "ci devo pensare".`,
    });
  }

  // 4) Appuntamenti fissati ma poco incontrati
  const seenMe = rate(me.visti, me.fissati);
  const seenAvg = pooled("visti", "fissati");
  if (seenMe !== null && seenAvg && me.fissati >= 5 && seenMe < seenAvg * LOW) {
    out.push({
      level: level(seenMe / seenAvg),
      area: "Conferma degli appuntamenti",
      title: "Molti appuntamenti fissati ma pochi realizzati",
      text: `Incontri il ${Math.round(seenMe * 100)}% degli appuntamenti fissati (media degli altri ${Math.round(seenAvg * 100)}%). Formazione: conferma il giorno prima, scegli orari solidi, fissa solo con chi decide.`,
    });
  }

  // 5) Incontri ma pochi contratti: problema in vendita
  const closeMe = rate(me.chiusi, me.visti);
  const closeAvg = pooled("chiusi", "visti");
  if (closeMe !== null && closeAvg && me.visti >= 5 && closeMe < closeAvg * LOW) {
    out.push({
      level: level(closeMe / closeAvg),
      area: "Tecnica di vendita",
      title: "Molti incontri ma pochi contratti: problema in vendita",
      text: `Chiudi il ${Math.round(closeMe * 100)}% degli incontri (media degli altri ${Math.round(closeAvg * 100)}%). Formazione: presentazione dell'offerta, gestione delle obiezioni e richiesta di chiusura.`,
    });
  }

  // 6) Incontri senza trattativa
  const noDealMe = rate(me.senza_trattativa, me.visti);
  const noDealAvg = pooled("senza_trattativa", "visti");
  if (noDealMe !== null && noDealAvg !== null && me.visti >= 5 && noDealMe > 0.4 && noDealMe > noDealAvg + 0.2) {
    out.push({
      level: "yellow",
      area: "Qualifica e presentazione dell'offerta",
      title: "Molti incontri senza trattativa",
      text: `Il ${Math.round(noDealMe * 100)}% dei tuoi incontri finisce senza trattativa (media degli altri ${Math.round(noDealAvg * 100)}%). Formazione: qualifica del cliente prima dell'appuntamento e partenza dell'offerta nei primi minuti.`,
    });
  }

  // 7) Trattative aperte che non si chiudono
  const dealsMe = me.chiusi + me.con_trattativa;
  const dealCloseMe = rate(me.chiusi, dealsMe);
  const dealsAvgNum = peers.reduce((s, p) => s + p.chiusi, 0);
  const dealsAvgDen = peers.reduce((s, p) => s + p.chiusi + p.con_trattativa, 0);
  const dealCloseAvg = dealsAvgDen > 0 ? dealsAvgNum / dealsAvgDen : null;
  if (dealCloseMe !== null && dealCloseAvg && dealsMe >= 5 && dealCloseMe < dealCloseAvg * LOW) {
    out.push({
      level: level(dealCloseMe / dealCloseAvg),
      area: "Chiusura della trattativa",
      title: "Le trattative aperte non si chiudono",
      text: `Delle trattative avviate ne chiudi il ${Math.round(dealCloseMe * 100)}% (media degli altri ${Math.round(dealCloseAvg * 100)}%). Formazione: follow-up dopo l'incontro e chiusura con una scadenza chiara.`,
    });
  }

  if (out.length === 0) {
    out.push({
      level: "green",
      area: "Tutto in linea",
      title: "Nessuna criticità rispetto agli altri agenti",
      text: `Chiamate (${f0(callsMe)}/giorno) e contatti (${f0(contMe)}/giorno) sono in linea con la media. Continua così.`,
    });
  }
  return out;
}

import { sql } from "./auth";

/**
 * Media appuntamenti presi OGGI tra gli agenti che hanno chiamato (totale della giornata):
 * appuntamenti fissati da chi ha fatto almeno una chiamata / numero di agenti che hanno chiamato.
 */
export async function averageAppointmentsToday(): Promise<{ avg: number; agents: number; total: number }> {
  const row = (
    await sql`
    SELECT count(*) FILTER (WHERE s.chiamate > 0)::int AS agents,
           coalesce(sum(s.fissati) FILTER (WHERE s.chiamate > 0), 0)::int AS total
    FROM agent_stats_combined s JOIN users u ON u.id = s.agent_id
    WHERE s.stat_date = (now() AT TIME ZONE 'Europe/Rome')::date AND u.status = 'attivo'`
  )[0];
  const agents = Number(row.agents);
  const total = Number(row.total);
  return { avg: agents > 0 ? Math.round((total / agents) * 10) / 10 : 0, agents, total };
}
