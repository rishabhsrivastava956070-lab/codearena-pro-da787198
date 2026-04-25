export const difficultyClass = (d: string) => {
  if (d === "easy") return "text-difficulty-easy";
  if (d === "medium") return "text-difficulty-medium";
  return "text-difficulty-hard";
};

export const difficultyBg = (d: string) => {
  if (d === "easy") return "bg-difficulty-easy/15 text-difficulty-easy border-difficulty-easy/30";
  if (d === "medium") return "bg-difficulty-medium/15 text-difficulty-medium border-difficulty-medium/30";
  return "bg-difficulty-hard/15 text-difficulty-hard border-difficulty-hard/30";
};

export const difficultyLabel = (d: string) =>
  d.charAt(0).toUpperCase() + d.slice(1);