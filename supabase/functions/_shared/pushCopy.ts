// Push copy in the user's language. The app has had a Serbian translation all
// along, but everything sent from the server was hardcoded English.
// `profiles.language` carries the choice (synced by the client); every push
// payload is built through here.

export type Lang = "en" | "sr";

export function toLang(value: string | null | undefined): Lang {
  return value === "sr" ? "sr" : "en";
}

/** Serbian has three plural forms (1, 2–4, 5+); English two. */
export function plural<T>(lang: Lang, n: number, one: T, few: T, many: T): T {
  if (lang === "en") return n === 1 ? one : many;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export type Payload = { title: string; body: string; data: Record<string, unknown> };

type Copy = {
  dailyTitle: (goal: string | null) => string;
  dailyBody: (items: string[], extra: number) => string;
  recap: () => { title: string; body: string };
  eatFirst: (names: string[]) => { title: string; body: string };
  streak: (streak: number, freezes: number, urgentName: string | null) => { title: string; body: string };
  topUp: () => { title: string; body: string };
  reengagement: () => { title: string; body: string };
  memberActivity: (name: string, count: number) => { title: string; body: string };
  memberCooked: (name: string, dish: string | null) => { title: string; body: string };
  memberChange: (name: string, kind: "joined" | "left" | "removed") => { title: string; body: string };
  shopping: (names: string[], extra: number) => { title: string; body: string };
};

const en: Copy = {
  dailyTitle: (goal) =>
    goal === "money" ? "Save money tonight"
    : goal === "quick" ? "Quick dinner idea"
    : "Use it before it goes",
  dailyBody: (items, extra) =>
    `Tonight: cook with ${items.join(", ")}${extra > 0 ? ` and ${extra} more` : ""}.`,
  recap: () => ({
    title: "Your week with leftovr",
    body: "See what you used and saved this week.",
  }),
  eatFirst: (names) => ({
    title: "Eat these first",
    body: `${names.join(", ")} ${names.length > 1 ? "need" : "needs"} using today.`,
  }),
  streak: (streak, freezes, urgentName) => ({
    title: freezes > 0
      ? `Keep your ${streak}-day streak going`
      : `Your ${streak}-day streak ends at midnight`,
    body: urgentName
      ? `${urgentName} needs using today. Use it tonight to keep your streak growing.`
      : freezes > 0
        ? "A freeze will cover today, but using up one thing tonight keeps it growing."
        : "Use up one thing from your kitchen tonight to keep it.",
  }),
  topUp: () => ({
    title: "Keep your suggestions sharp",
    body: "Scan a receipt so leftovr knows what you have.",
  }),
  reengagement: () => ({
    title: "What's for dinner?",
    body: "Open leftovr for a quick idea from what you have.",
  }),
  memberActivity: (name, count) => ({
    title: "Kitchen updated",
    body: `${name} added ${count} item${count === 1 ? "" : "s"} to your kitchen.`,
  }),
  memberCooked: (name, dish) => ({
    title: "Dinner's handled",
    body: dish ? `${name} cooked ${dish}.` : `${name} cooked from your kitchen.`,
  }),
  memberChange: (name, kind) => ({
    title: kind === "joined" ? "New housemate" : "Your kitchen changed",
    body: kind === "joined"
      ? `${name} joined your kitchen.`
      : kind === "removed"
        ? `${name} was removed from your kitchen.`
        : `${name} left your kitchen.`,
  }),
  shopping: (names, extra) => ({
    title: "Shopping today?",
    body: `Don't forget ${names.join(", ")}${extra > 0 ? ` and ${extra} more` : ""}.`,
  }),
};

const sr: Copy = {
  dailyTitle: (goal) =>
    goal === "money" ? "Uštedi novac večeras"
    : goal === "quick" ? "Brza ideja za večeru"
    : "Iskoristi pre nego što propadne",
  dailyBody: (items, extra) =>
    `Večeras: kuvaj sa ${items.join(", ")}${extra > 0 ? ` i još ${extra}` : ""}.`,
  recap: () => ({
    title: "Tvoja nedelja sa leftovr",
    body: "Pogledaj šta si iskoristio/la i uštedeo/la ove nedelje.",
  }),
  eatFirst: (names) => ({
    title: "Pojedi prvo",
    body: `${names.join(", ")} treba iskoristiti danas.`,
  }),
  streak: (streak, freezes, urgentName) => {
    const days = plural("sr", streak, "dan", "dana", "dana");
    return {
      title: freezes > 0
        ? `Sačuvaj niz od ${streak} ${days}`
        : `Tvoj niz od ${streak} ${days} se završava u ponoć`,
      body: urgentName
        ? `${urgentName} treba iskoristiti danas. Iskoristi to večeras da niz raste.`
        : freezes > 0
          ? "Zamrzavanje će pokriti danas, ali ako iskoristiš nešto večeras, niz raste."
          : "Iskoristi nešto iz kuhinje večeras da sačuvaš niz.",
    };
  },
  topUp: () => ({
    title: "Neka predlozi budu precizni",
    body: "Skeniraj račun da leftovr zna šta imaš.",
  }),
  reengagement: () => ({
    title: "Šta ima za večeru?",
    body: "Otvori leftovr za brzu ideju od onoga što imaš.",
  }),
  memberActivity: (name, count) => ({
    title: "Kuhinja je ažurirana",
    body: `${name} je dodao/la ${count} ${plural("sr", count, "namirnicu", "namirnice", "namirnica")} u tvoju kuhinju.`,
  }),
  memberCooked: (name, dish) => ({
    title: "Večera je rešena",
    body: dish ? `${name} je skuvao/la ${dish}.` : `${name} je kuvao/la od onoga što je u kuhinji.`,
  }),
  memberChange: (name, kind) => ({
    title: kind === "joined" ? "Novi ukućanin" : "Promena u kuhinji",
    body: kind === "joined"
      ? `${name} se pridružio/la tvojoj kuhinji.`
      : kind === "removed"
        ? `${name} je uklonjen/a iz tvoje kuhinje.`
        : `${name} je napustio/la tvoju kuhinju.`,
  }),
  shopping: (names, extra) => ({
    title: "Ideš u kupovinu?",
    body: `Ne zaboravi: ${names.join(", ")}${extra > 0 ? ` i još ${extra}` : ""}.`,
  }),
};

export function copy(lang: Lang): Copy {
  return lang === "sr" ? sr : en;
}
