/** Terms and Privacy pages on leftovr.co; Serbian has its own pages under /sr/. */
export const legalUrl = (page: "privacy" | "terms", language: string) =>
  `https://leftovr.co/${language === "sr" ? "sr/" : ""}${page}/`;
