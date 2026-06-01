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

export const RECIPE_LIBRARY: MockRecipe[] = [
  {
    key: "spinach-feta-pasta",
    title: "Spinach & feta pasta",
    description: "Quick wilted spinach tossed with pasta and salty feta.",
    timeMinutes: 20,
    complexity: "simple",
    servingsBaseline: 2,
    category: "pasta",
    mealType: "dinner",
    tags: ["quick", "veggie", "comfort"],
    avoidanceTags: ["dairy", "gluten"],
    ingredients: [
      { name: "Spinach", amount: "100g", required: true, countable: false },
      { name: "Pasta", amount: "200g", required: true, countable: false },
      { name: "Garlic", amount: "3 cloves", required: true, countable: true },
      { name: "Olive oil", amount: "2 tbsp", required: true, countable: false },
      { name: "Cheddar", amount: "50g", required: false, countable: false },
    ],
    steps: [
      "Boil pasta until al dente. Save a mug of pasta water.",
      "Heat olive oil. Sauté garlic until just golden.",
      "Toss in spinach until it wilts, about 2 minutes.",
      "Add pasta, splash of water, crumbled cheese. Salt to taste.",
    ],
  },
  {
    key: "mediterranean-chicken-bowl",
    title: "Mediterranean chicken bowl",
    description: "Grilled chicken with tomatoes, yogurt, and warm spices.",
    timeMinutes: 30,
    complexity: "medium",
    servingsBaseline: 2,
    category: "bowl",
    mealType: "lunch",
    tags: ["protein", "healthy"],
    avoidanceTags: ["dairy", "meat"],
    ingredients: [
      { name: "Chicken breast", amount: "200g", required: true, countable: false },
      { name: "Tomatoes", amount: "2 medium", required: true, countable: true },
      { name: "Greek yogurt", amount: "100g", required: false, countable: false },
      { name: "Rice", amount: "150g", required: true, countable: false },
      { name: "Olive oil", amount: "1 tbsp", required: true, countable: false },
    ],
    steps: [
      "Cook rice according to package directions.",
      "Season chicken with salt, pepper, paprika. Pan-fry 6 min per side.",
      "Dice tomatoes. Mix with a drizzle of olive oil.",
      "Bowl: rice, sliced chicken, tomatoes, dollop of yogurt.",
    ],
  },
  {
    key: "cheesy-egg-toast",
    title: "Cheesy egg toast",
    description: "Fried eggs on crispy toast with melted cheese.",
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
      "Toast bread until golden.",
      "Fry eggs in butter, sunny side up.",
      "Place eggs on toast, top with cheese. Let melt under a lid.",
    ],
  },
  {
    key: "tomato-basil-galette",
    title: "Tomato & basil galette",
    description: "Rustic free-form tart with fresh tomatoes.",
    timeMinutes: 45,
    complexity: "involved",
    servingsBaseline: 4,
    category: "baking",
    mealType: "dinner",
    tags: ["veggie", "weekend"],
    avoidanceTags: ["dairy", "gluten"],
    ingredients: [
      { name: "Tomatoes", amount: "3 large", required: true, countable: true },
      { name: "Cheddar", amount: "80g", required: true, countable: false },
      { name: "Olive oil", amount: "2 tbsp", required: true, countable: false },
    ],
    steps: [
      "Roll out pastry dough into a rough circle.",
      "Spread cheese in the centre, leaving a border.",
      "Layer sliced tomatoes. Fold edges over.",
      "Bake at 200°C for 25-30 minutes until golden.",
    ],
  },
  {
    key: "green-shakshuka",
    title: "Green shakshuka",
    description: "Eggs poached in a spiced spinach and herb sauce.",
    timeMinutes: 25,
    complexity: "medium",
    servingsBaseline: 2,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["veggie", "healthy", "brunch"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Eggs", amount: "4", required: true, countable: true },
      { name: "Spinach", amount: "200g", required: true, countable: false },
      { name: "Garlic", amount: "2 cloves", required: true, countable: true },
      { name: "Olive oil", amount: "2 tbsp", required: true, countable: false },
    ],
    steps: [
      "Sauté garlic in olive oil until fragrant.",
      "Add spinach, cook until wilted. Season with cumin and salt.",
      "Make wells, crack eggs in. Cover and cook 5-7 min.",
      "Serve from the pan with crusty bread.",
    ],
  },
  {
    key: "salmon-rice-bowl",
    title: "Salmon rice bowl",
    description: "Pan-seared salmon over rice with a soy glaze.",
    timeMinutes: 25,
    complexity: "medium",
    servingsBaseline: 2,
    category: "bowl",
    mealType: "dinner",
    tags: ["protein", "healthy", "fish"],
    avoidanceTags: ["fish"],
    ingredients: [
      { name: "Salmon", amount: "2 fillets", required: true, countable: true },
      { name: "Rice", amount: "200g", required: true, countable: false },
      { name: "Spinach", amount: "50g", required: false, countable: false },
    ],
    steps: [
      "Cook rice. Season salmon with salt and pepper.",
      "Pan-sear salmon skin-down 4 min, flip, 3 min more.",
      "Wilt spinach in the same pan.",
      "Bowl: rice, salmon, spinach. Drizzle with soy sauce.",
    ],
  },
  {
    key: "banana-oat-pancakes",
    title: "Banana oat pancakes",
    description: "Naturally sweet pancakes with just bananas and oats.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "breakfast", "veggie"],
    avoidanceTags: ["gluten"],
    ingredients: [
      { name: "Bananas", amount: "2 ripe", required: true, countable: true },
      { name: "Eggs", amount: "2", required: true, countable: true },
      { name: "Milk", amount: "splash", required: false, countable: false },
    ],
    steps: [
      "Mash bananas. Mix in eggs and a splash of milk.",
      "Heat a non-stick pan over medium heat.",
      "Spoon batter in, cook 2 min per side until golden.",
      "Serve with honey or fruit.",
    ],
  },
  {
    key: "one-pan-butter-dal",
    title: "One-pan butter dal",
    description: "Creamy spiced lentils in a rich tomato sauce.",
    timeMinutes: 30,
    complexity: "simple",
    servingsBaseline: 4,
    category: "curry",
    mealType: "dinner",
    tags: ["veggie", "comfort", "batch"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Tomatoes", amount: "400g tin", required: true, countable: true },
      { name: "Garlic", amount: "3 cloves", required: true, countable: true },
      { name: "Rice", amount: "200g", required: false, countable: false },
    ],
    steps: [
      "Sauté garlic and spices in butter until fragrant.",
      "Add lentils and tinned tomatoes. Simmer 20 min.",
      "Stir in cream or yogurt. Season well.",
      "Serve over rice.",
    ],
  },
  {
    key: "chicken-stir-fry",
    title: "Quick chicken stir-fry",
    description: "Fast weeknight stir-fry with whatever veg you have.",
    timeMinutes: 15,
    complexity: "simple",
    servingsBaseline: 2,
    category: "stir-fry",
    mealType: "dinner",
    tags: ["quick", "protein", "healthy"],
    avoidanceTags: ["meat"],
    ingredients: [
      { name: "Chicken breast", amount: "200g", required: true, countable: false },
      { name: "Spinach", amount: "50g", required: false, countable: false },
      { name: "Garlic", amount: "2 cloves", required: true, countable: true },
      { name: "Rice", amount: "150g", required: false, countable: false },
    ],
    steps: [
      "Slice chicken thin. Stir-fry in hot oil 3-4 min.",
      "Add garlic and vegetables. Toss 2 min.",
      "Splash soy sauce. Serve over rice.",
    ],
  },
  {
    key: "yogurt-fruit-bowl",
    title: "Yogurt & fruit bowl",
    description: "Thick yogurt layered with fresh fruit and a drizzle of honey.",
    timeMinutes: 5,
    complexity: "simple",
    servingsBaseline: 1,
    category: "breakfast",
    mealType: "snack",
    tags: ["quick", "breakfast", "healthy", "no-cook"],
    avoidanceTags: ["dairy"],
    ingredients: [
      { name: "Greek yogurt", amount: "200g", required: true, countable: false },
      { name: "Bananas", amount: "1", required: false, countable: true },
    ],
    steps: [
      "Spoon yogurt into a bowl.",
      "Slice banana and any other fruit on top.",
      "Drizzle with honey. Add granola if you have it.",
    ],
  },
  {
    key: "egg-fried-rice",
    title: "Egg fried rice",
    description: "Fast comfort rice using whatever's in the fridge.",
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
      { name: "Frozen peas", amount: "handful", required: false, countable: false },
    ],
    steps: [
      "Scramble eggs in a hot wok. Set aside.",
      "Stir-fry garlic and peas 1 min.",
      "Add cold rice, toss on high heat 3 min.",
      "Return eggs, splash soy sauce, toss to combine.",
    ],
  },
  {
    key: "hummus-veggie-wrap",
    title: "Hummus veggie wrap",
    description: "Creamy hummus with crunchy vegetables in a wrap.",
    timeMinutes: 10,
    complexity: "simple",
    servingsBaseline: 1,
    category: "wrap",
    mealType: "lunch",
    tags: ["quick", "veggie", "no-cook", "healthy"],
    avoidanceTags: ["gluten", "nuts"],
    ingredients: [
      { name: "Hummus", amount: "3 tbsp", required: true, countable: false },
      { name: "Tomatoes", amount: "1 medium", required: false, countable: true },
      { name: "Spinach", amount: "handful", required: false, countable: false },
    ],
    steps: [
      "Warm a tortilla or flatbread.",
      "Spread hummus generously.",
      "Layer spinach, sliced tomatoes, and any other veg.",
      "Roll tightly and slice in half.",
    ],
  },
];
