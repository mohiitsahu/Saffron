export const MAX_MEAL_PHOTOS = 6;
export const mealPhotoSelect = { id: true, dishName: true, caption: true, position: true } as const;
export const mealPhotoOrder = [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;
export type MealPhotoItem = { id: string; dishName: string; caption: string; position: number };
export function mealPhotoUrl(id: string) { return `/api/meal-photos/${encodeURIComponent(id)}`; }
