const fs = require("fs");
const path = require("path");

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getPlanConfig(planName) {
  if (!planName) return { count: 0, minStars: 0, maxStars: 0 };
  const n = String(planName).toLowerCase();

  if (n.includes("explor")) return { count: 4, minStars: 1, maxStars: 3 }; // Explorateur
  if (n.includes("avent")) return { count: 10, minStars: 1, maxStars: 5 }; // Aventurier
  if (n.includes("creat") || n.includes("createur")) return { count: 20, minStars: 1, maxStars: 5 }; // Createur

  return { count: 4, minStars: 1, maxStars: 3 }; // Fallback
}

function loadSpots() {
  try {
    const p = path.resolve(__dirname, "../src/data/localisation.json");
    const raw = fs.readFileSync(p, "utf8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error(
      "unlock.loadSpots: failed to read localisation.json",
      e?.message || e
    );
    return [];
  }
}

function findNearestForPlan(lat, lng, planName, excludeUids = [], providedSpots = null) {
  const config = getPlanConfig(planName);
  if (!config.count) return { selected: [], count: 0 };

  const rawSpots = Array.isArray(providedSpots) ? providedSpots : loadSpots();

  const spots = rawSpots.filter(
    (s) => {
      // Use uid or id as fallback for the unique identifier
      const spotUid = s.uid || (s.id ? String(s.id) : null);
      if (!spotUid || !s.lat || !s.lng) return false;
      if (excludeUids.includes(spotUid)) return false;

      const stars = Number(s.stars) || 3;
      return stars >= config.minStars && stars <= config.maxStars;
    }
  );

  const withDist = spots.map((s) => ({
    ...s,
    spotUid: s.uid || String(s.id),
    distKm: haversineDistance(lat, lng, Number(s.lat), Number(s.lng)),
  }));
  withDist.sort((a, b) => a.distKm - b.distKm);

  const selected = withDist.slice(0, config.count).map((s) => s.spotUid);

  return {
    selected,
    count: config.count
  };
}

module.exports = { findNearestForPlan };
