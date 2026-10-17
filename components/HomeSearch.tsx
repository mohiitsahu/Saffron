"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import type { CityOption } from "@/lib/cities";

export default function HomeSearch({ chefCities }: { chefCities: CityOption[] }) {
  const router = useRouter();

  function go(q: string, city: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    const qs = params.toString();
    router.push(qs ? `/chefs?${qs}` : "/chefs");
  }

  return <SearchBar variant="hero" chefCities={chefCities} onSubmit={go} />;
}