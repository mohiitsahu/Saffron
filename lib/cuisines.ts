// Lowercase, because cuisines are stored lowercase.
export const CUISINE_OPTIONS = [
  "north indian",
  "south indian",
  "mughlai",
  "punjabi",
  "rajasthani",
  "gujarati",
  "bengali",
  "maharashtrian",
  "hyderabadi",
  "kerala",
  "goan",
  "street food",
  "chinese",
  "italian",
  "continental",
  "mexican",
  "thai",
  "japanese",
  "mediterranean",
  "barbecue and grills",
  "baking and desserts",
  "jain",
  "vegetarian",
  "vegan",
] as const;

export const MAX_CUISINES = 8;

export type CuisineOption = { name: string; count: number };