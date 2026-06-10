export type MockIngredient = {
  name: string;
  amount: string;
  required: boolean;
  countable: boolean;
};

export type MockRecipe = {
  key: string;
  title: string;
  description: string;
  timeMinutes: number;
  complexity: "simple" | "medium" | "involved";
  servingsBaseline: number;
  category: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  tags: string[];
  avoidanceTags: string[];
  ingredients: MockIngredient[];
  steps: string[];
};

/**
 * Mirrors what AI generation will do: every REQUIRED ingredient comes from
 * the demo receipt template items (eggs, milk, greek yogurt, cheddar,
 * chicken breast, spinach, tomatoes, bananas, sourdough, rice). Anything
 * outside the fridge (garlic, olive oil, butter) is optional — a
 * nice-to-have, never a blocker.
 */
export const RECIPE_LIBRARY: MockRecipe[] = [
  {
    key: "spinach-cheddar-omelette",
    title: "Spinach & cheddar omelette",
    description: "Fluffy omelette folded over wilted spinach and melted cheddar.",
    timeMinutes: 10,
    complexity: "simple",
    servingsBaseline: 1,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "veggie", "protein"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Eggs", amount: "3", required: true, countable: true },
      { name: "Spinach", amount: "handful", required: true, countable: false },
      { name: "Cheddar", amount: "30g", required: true, countable: false },
      { name: "Butter", amount: "1 tbsp", required: false, countable: false },
    ],
    steps: [
      "Whisk eggs with a pinch of salt.",
      "Wilt spinach in butter, set aside.",
      "Pour eggs into the pan, cook until just set.",
      "Add spinach and cheddar, fold, slide onto a plate.",
    ],
  },
  {
    key: "cheesy-egg-toast",
    title: "Cheesy egg toast",
    description: "Fried eggs on crispy sourdough with melted cheddar.",
    timeMinutes: 10,
    complexity: "simple",
    servingsBaseline: 1,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "breakfast", "comfort"],
    avoidanceTags: ["dairy", "gluten"],
    ingredients: [
      { name: "Eggs", amount: "2", required: true, countable: true },
      { name: "Sourdough", amount: "2 slices", required: true, countable: true },
      { name: "Cheddar", amount: "30g", required: true, countable: false },
    ],
    steps: [
      "Toast sourdough until golden.",
      "Fry eggs in butter, sunny side up.",
      "Place eggs on toast, top with cheddar. Let melt under a lid.",
    ],
  },
  {
    key: "banana-french-toast",
    title: "Banana french toast",
    description: "Sourdough soaked in egg and milk, topped with caramelised banana.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["breakfast", "comfort", "weekend"],
    avoidanceTags: ["dairy", "gluten"],
    ingredients: [
      { name: "Sourdough", amount: "4 slices", required: true, countable: true },
      { name: "Eggs", amount: "2", required: true, countable: true },
      { name: "Milk", amount: "100ml", required: true, countable: false },
      { name: "Bananas", amount: "1", required: false, countable: true },
    ],
    steps: [
      "Whisk eggs and milk in a shallow bowl.",
      "Soak sourdough slices 30 seconds per side.",
      "Fry in butter until golden, 2-3 min per side.",
      "Top with sliced banana fried in the same pan.",
    ],
  },
  {
    key: "banana-pancakes",
    title: "Banana pancakes",
    description: "Two-ingredient pancakes, naturally sweet, no flour needed.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "breakfast", "veggie", "healthy"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Bananas", amount: "2 ripe", required: true, countable: true },
      { name: "Eggs", amount: "2", required: true, countable: true },
      { name: "Milk", amount: "splash", required: false, countable: false },
    ],
    steps: [
      "Mash bananas. Mix in eggs and a splash of milk.",
      "Heat a non-stick pan over medium heat.",
      "Spoon batter in, cook 2 min per side until golden.",
      "Serve with yogurt or fruit.",
    ],
  },
  {
    key: "yogurt-banana-bowl",
    title: "Yogurt & banana bowl",
    description: "Thick greek yogurt layered with banana and a drizzle of honey.",
    timeMinutes: 5,
    complexity: "simple",
    servingsBaseline: 1,
    category: "breakfast",
    mealType: "snack",
    tags: ["quick", "healthy", "no-cook"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Greek yogurt", amount: "200g", required: true, countable: false },
      { name: "Bananas", amount: "1", required: false, countable: true },
    ],
    steps: [
      "Spoon yogurt into a bowl.",
      "Slice banana on top.",
      "Drizzle with honey if you have it.",
    ],
  },
  {
    key: "tomato-cheddar-melt",
    title: "Tomato & cheddar melt",
    description: "Grilled sourdough with juicy tomato and bubbling cheddar.",
    timeMinutes: 10,
    complexity: "simple",
    servingsBaseline: 1,
    category: "sandwich",
    mealType: "lunch",
    tags: ["quick", "veggie", "comfort"],
    avoidanceTags: ["dairy", "gluten"],
    ingredients: [
      { name: "Sourdough", amount: "2 slices", required: true, countable: true },
      { name: "Tomatoes", amount: "1 medium", required: true, countable: true },
      { name: "Cheddar", amount: "50g", required: true, countable: false },
    ],
    steps: [
      "Butter the sourdough on the outside.",
      "Layer sliced tomato and cheddar between the slices.",
      "Grill in a pan 3 min per side until the cheese melts.",
    ],
  },
  {
    key: "egg-fried-rice",
    title: "Egg fried rice",
    description: "Fast comfort rice with scrambled egg and garlic.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "rice",
    mealType: "lunch",
    tags: ["quick", "comfort", "veggie"],
    avoidanceTags: [],
    ingredients: [
      { name: "Rice", amount: "300g cooked", required: true, countable: false },
      { name: "Eggs", amount: "2", required: true, countable: true },
      { name: "Garlic", amount: "2 cloves", required: false, countable: true },
      { name: "Spinach", amount: "handful", required: false, countable: false },
    ],
    steps: [
      "Scramble eggs in a hot pan. Set aside.",
      "Stir-fry garlic 30 seconds, add cold rice, toss on high heat 3 min.",
      "Return eggs, toss in spinach until wilted.",
      "Season with salt or a splash of soy sauce.",
    ],
  },
  {
    key: "mediterranean-chicken-bowl",
    title: "Mediterranean chicken bowl",
    description: "Pan-fried chicken over rice with tomatoes and a yogurt dollop.",
    timeMinutes: 30,
    complexity: "medium",
    servingsBaseline: 2,
    category: "bowl",
    mealType: "lunch",
    tags: ["protein", "healthy"],
    avoidanceTags: ["meat", "dairy"],
    ingredients: [
      { name: "Chicken breast", amount: "200g", required: true, countable: false },
      { name: "Rice", amount: "150g", required: true, countable: false },
      { name: "Tomatoes", amount: "2 medium", required: true, countable: true },
      { name: "Greek yogurt", amount: "100g", required: false, countable: false },
      { name: "Olive oil", amount: "1 tbsp", required: false, countable: false },
    ],
    steps: [
      "Cook rice according to package directions.",
      "Season chicken with salt, pepper, paprika. Pan-fry 6 min per side.",
      "Dice tomatoes, dress with olive oil.",
      "Bowl: rice, sliced chicken, tomatoes, dollop of yogurt.",
    ],
  },
  {
    key: "chicken-spinach-stir-fry",
    title: "Chicken & spinach stir-fry",
    description: "Fast weeknight stir-fry with garlic and greens.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "stir-fry",
    mealType: "dinner",
    tags: ["quick", "protein", "healthy"],
    avoidanceTags: ["meat"],
    ingredients: [
      { name: "Chicken breast", amount: "200g", required: true, countable: false },
      { name: "Spinach", amount: "100g", required: true, countable: false },
      { name: "Garlic", amount: "2 cloves", required: false, countable: true },
      { name: "Rice", amount: "150g", required: false, countable: false },
    ],
    steps: [
      "Slice chicken thin. Stir-fry in hot oil 3-4 min.",
      "Add garlic, toss 1 min.",
      "Add spinach, toss until just wilted.",
      "Serve over rice.",
    ],
  },
  {
    key: "creamy-tomato-chicken",
    title: "Creamy tomato chicken",
    description: "Chicken simmered in a garlicky tomato-yogurt sauce over rice.",
    timeMinutes: 35,
    complexity: "medium",
    servingsBaseline: 2,
    category: "curry",
    mealType: "dinner",
    tags: ["protein", "comfort"],
    avoidanceTags: ["meat", "dairy"],
    ingredients: [
      { name: "Chicken breast", amount: "300g", required: true, countable: false },
      { name: "Tomatoes", amount: "4 medium", required: true, countable: true },
      { name: "Greek yogurt", amount: "150g", required: true, countable: false },
      { name: "Rice", amount: "200g", required: true, countable: false },
      { name: "Garlic", amount: "3 cloves", required: false, countable: true },
    ],
    steps: [
      "Cook rice. Brown diced chicken in olive oil, set aside.",
      "Sauté garlic, add chopped tomatoes, simmer 10 min into a sauce.",
      "Return chicken, simmer 8 min until cooked through.",
      "Off the heat, stir in yogurt. Serve over rice.",
    ],
  },
  {
    key: "baked-tomato-rice",
    title: "Baked tomato rice",
    description: "One-dish oven rice with roasted tomatoes, garlic, and spinach.",
    timeMinutes: 45,
    complexity: "medium",
    servingsBaseline: 4,
    category: "rice",
    mealType: "dinner",
    tags: ["veggie", "healthy", "batch"],
    avoidanceTags: [],
    ingredients: [
      { name: "Rice", amount: "300g", required: true, countable: false },
      { name: "Tomatoes", amount: "4 medium", required: true, countable: true },
      { name: "Spinach", amount: "100g", required: false, countable: false },
      { name: "Garlic", amount: "4 cloves", required: false, countable: true },
      { name: "Olive oil", amount: "2 tbsp", required: false, countable: false },
    ],
    steps: [
      "Heat oven to 200°C. Toss halved tomatoes and garlic with olive oil in a baking dish.",
      "Roast 15 min, then stir in rice and double its volume of hot water.",
      "Cover and bake 20-25 min until the rice is tender.",
      "Fold through spinach to wilt before serving.",
    ],
  },
  {
    key: "green-shakshuka",
    title: "Green shakshuka",
    description: "Eggs poached in garlicky wilted spinach.",
    timeMinutes: 25,
    complexity: "medium",
    servingsBaseline: 2,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["veggie", "healthy", "brunch"],
    avoidanceTags: [],
    ingredients: [
      { name: "Eggs", amount: "4", required: true, countable: true },
      { name: "Spinach", amount: "200g", required: true, countable: false },
      { name: "Garlic", amount: "2 cloves", required: false, countable: true },
      { name: "Olive oil", amount: "2 tbsp", required: false, countable: false },
      { name: "Sourdough", amount: "to serve", required: false, countable: false },
    ],
    steps: [
      "Sauté garlic in olive oil until fragrant.",
      "Add spinach, cook until wilted. Season with cumin and salt.",
      "Make wells, crack eggs in. Cover and cook 5-7 min.",
      "Serve from the pan with toasted sourdough.",
    ],
  },
];
