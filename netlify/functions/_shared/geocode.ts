// Trasforma un indirizzo in coordinate con OpenStreetMap Nominatim (gratuito).
// Regole d'uso: poche richieste, User-Agent riconoscibile, massimo 1 richiesta al secondo.
export async function geocode(
  address: string | null,
  city: string | null,
  province: string | null,
): Promise<{ lat: number; lng: number } | null> {
  if (!address || !address.trim()) return null;
  const query = [address, city, province, "Italia"].filter((part) => part && part.trim()).join(", ");
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it&q=" +
    encodeURIComponent(query);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `FAD-LeadHub/1.0 (${process.env.GEOCODE_CONTACT || "leadhub@fad.it"})`,
        "Accept-Language": "it",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as { lat: string; lon: string }[];
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = Number(results[0].lat);
    const lng = Number(results[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
