export type City = { name: string; lat: number; lng: number; aliases?: string[] };
export type CityOption = { name: string; count: number };

export const INDIAN_CITIES: City[] = [
  { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { name: "Indore", lat: 22.7196, lng: 75.8577 },
  { name: "Ujjain", lat: 23.1765, lng: 75.7885 },
  { name: "Jabalpur", lat: 23.1815, lng: 79.9864 },
  { name: "Gwalior", lat: 26.2183, lng: 78.1828 },
  { name: "Sagar", lat: 23.8388, lng: 78.7378 },
  { name: "Raipur", lat: 21.2514, lng: 81.6296 },
  { name: "Bilaspur", lat: 22.0797, lng: 82.1409 },
  { name: "Delhi", lat: 28.6139, lng: 77.209, aliases: ["New Delhi"] },
  { name: "Gurugram", lat: 28.4595, lng: 77.0266, aliases: ["Gurgaon"] },
  { name: "Noida", lat: 28.5355, lng: 77.391 },
  { name: "Faridabad", lat: 28.4089, lng: 77.3178 },
  { name: "Ghaziabad", lat: 28.6692, lng: 77.4538 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Mohali", lat: 30.7046, lng: 76.7179 },
  { name: "Panchkula", lat: 30.6942, lng: 76.8606 },
  { name: "Ludhiana", lat: 30.901, lng: 75.8573 },
  { name: "Amritsar", lat: 31.634, lng: 74.8723 },
  { name: "Jalandhar", lat: 31.326, lng: 75.5762 },
  { name: "Dehradun", lat: 30.3165, lng: 78.0322 },
  { name: "Shimla", lat: 31.1048, lng: 77.1734 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Jodhpur", lat: 26.2389, lng: 73.0243 },
  { name: "Udaipur", lat: 24.5854, lng: 73.7125 },
  { name: "Kota", lat: 25.2138, lng: 75.8648 },
  { name: "Ajmer", lat: 26.4499, lng: 74.6399 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Kanpur", lat: 26.4499, lng: 80.3319 },
  { name: "Varanasi", lat: 25.3176, lng: 82.9739, aliases: ["Banaras"] },
  { name: "Prayagraj", lat: 25.4358, lng: 81.8463, aliases: ["Allahabad"] },
  { name: "Agra", lat: 27.1767, lng: 78.0081 },
  { name: "Meerut", lat: 28.9845, lng: 77.7064 },
  { name: "Patna", lat: 25.5941, lng: 85.1376 },
  { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { name: "Jamshedpur", lat: 22.8046, lng: 86.2029 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, aliases: ["Calcutta"] },
  { name: "Howrah", lat: 22.5958, lng: 88.2636 },
  { name: "Siliguri", lat: 26.7271, lng: 88.3953 },
  { name: "Bhubaneswar", lat: 20.2961, lng: 85.8245 },
  { name: "Cuttack", lat: 20.4625, lng: 85.883 },
  { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, aliases: ["Bombay"] },
  { name: "Thane", lat: 19.2183, lng: 72.9781 },
  { name: "Navi Mumbai", lat: 19.033, lng: 73.0297 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
  { name: "Nashik", lat: 19.9975, lng: 73.7898 },
  { name: "Aurangabad", lat: 19.8762, lng: 75.3433 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Gandhinagar", lat: 23.2156, lng: 72.6369 },
  { name: "Surat", lat: 21.1702, lng: 72.8311 },
  { name: "Vadodara", lat: 22.3072, lng: 73.1812, aliases: ["Baroda"] },
  { name: "Rajkot", lat: 22.3039, lng: 70.8022 },
  { name: "Panaji", lat: 15.4909, lng: 73.8278, aliases: ["Goa"] },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Warangal", lat: 17.9689, lng: 79.5941 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185, aliases: ["Vizag"] },
  { name: "Vijayawada", lat: 16.5062, lng: 80.648 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, aliases: ["Bangalore"] },
  { name: "Mysuru", lat: 12.2958, lng: 76.6394, aliases: ["Mysore"] },
  { name: "Mangaluru", lat: 12.9141, lng: 74.856, aliases: ["Mangalore"] },
  { name: "Hubballi", lat: 15.3647, lng: 75.124, aliases: ["Hubli"] },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, aliases: ["Madras"] },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { name: "Madurai", lat: 9.9252, lng: 78.1198 },
  { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047, aliases: ["Trichy"] },
  { name: "Puducherry", lat: 11.9416, lng: 79.8083, aliases: ["Pondicherry"] },
  { name: "Kochi", lat: 9.9312, lng: 76.2673, aliases: ["Cochin"] },
  { name: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366, aliases: ["Trivandrum"] },
  { name: "Kozhikode", lat: 11.2588, lng: 75.7804, aliases: ["Calicut"] },
  { name: "Srinagar", lat: 34.0837, lng: 74.7973 },
  { name: "Jammu", lat: 32.7266, lng: 74.857 },
];

const norm = (value: string) => value.trim().toLowerCase();

export function findCity(input: string): City | undefined {
  const text = norm(input);
  if (!text) return undefined;
  return INDIAN_CITIES.find(
    (c) => norm(c.name) === text || (c.aliases ?? []).some((a) => norm(a) === text)
  );
}

// Every name a chef might have typed for the same city. Used by the server-side search.
export function cityVariants(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const city = findCity(trimmed);
  return city ? [city.name, ...(city.aliases ?? [])] : [trimmed];
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Nearest listed city within maxKm, or null if the user is farther than that from all of them.
export function nearestCity(lat: number, lng: number, maxKm = 120): { city: City; km: number } | null {
  let best: { city: City; km: number } | null = null;

  for (const city of INDIAN_CITIES) {
    const dLat = toRad(city.lat - lat);
    const dLng = toRad(city.lng - lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(city.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (!best || km < best.km) best = { city, km };
  }

  return best && best.km <= maxKm ? best : null;
}