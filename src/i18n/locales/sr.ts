export const sr = {
  common: {
    continue: "Nastavi",
    loading: "Ucitavanje",
    recommended: "Preporuceno",
    signOut: "Odjavi se",
    unknownHousehold: "Samostalno domacinstvo",
  },
  auth: {
    configTitle: "Povezi Supabase",
    configBody: "Dodaj lokalni Supabase URL i anon key u .env.local, pa restartuj Expo.",
    signInTitle: "Dobro dosao nazad.",
    signInBody: "Prijavi se da tvoj frizider, recepti i domacinstvo ostanu sinhronizovani.",
    signUpTitle: "Napravi Chomp nalog.",
    signUpBody: "Email radi sada. Apple i Google su placeholderi za V1.",
    displayName: "Ime za prikaz",
    email: "Email",
    password: "Lozinka",
    signIn: "Prijavi se",
    signUp: "Napravi nalog",
    goToSignIn: "Vec imam nalog",
    goToSignUp: "Napravi nalog",
    apple: "Nastavi uz Apple",
    google: "Nastavi uz Google",
    oauthPlaceholder: "Uskoro",
    missingFields: "Popuni sva polja za nastavak.",
    missingSupabaseConfig: "Nedostaju Supabase environment variables.",
    genericError: "Nesto nije uspelo.",
  },
  onboarding: {
    title: "Personalizacija je sledeca.",
    body: "Faza 5 ce dodati ceo onboarding tok. Za sada auth rutiranje radi.",
  },
  firstFill: {
    title: "Hajde da napunimo frizider.",
    body: "Faza 7 ce dodati racun, barkod i rucni unos. Ovaj ekran proverava session gate.",
  },
  fridge: {
    title: "Hej, tvoj frizider.",
    titleWithName: "{{name}}, hej, tvoj frizider.",
    body: "Prijavljen si i spreman za sledecu fazu.",
  },
  scan: {
    title: "Skeniranje",
    body: "Racun, barkod i rucni unos uskoro pocinju ovde.",
  },
  recipes: {
    title: "Recepti",
    body: "Ovde ce ziveti recipe sessions.",
  },
  settings: {
    title: "Podesavanja",
    body: "Nalog, domacinstvo, jezik i prototype controls ce biti ovde.",
    languageTitle: "Jezik",
    languageBody: "Prebaci prototype izmedju engleskog i srpskog.",
    languages: {
      en: "English",
      sr: "Srpski",
    },
  },
  insights: {
    title: "Uvidi",
    body: "Premium recap pregledi ce biti ovde.",
  },
  premium: {
    title: "Chomp Premium",
  },
  retention: {
    title: "Pre nego sto odes",
  },
} as const;
