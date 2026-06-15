# Leftovr Design System

This folder translates the Claude prototype into native React Native building blocks.

Rules:

- Keep reusable visual patterns here instead of repeating screen-level styles.
- Keep user-facing copy outside reusable components. Pass translated strings from screens/features.
- Prefer tokens from `src/theme/tokens.ts` over raw color, spacing, font, or radius values.
- Keep components close to the prototype unless native mobile behavior requires a small adjustment.

Structure:

- `primitives/`: generic UI blocks such as `Screen`, `Text`, `Button`, `Card`, `BottomSheet`, `ChoiceCard`, and `SegmentedControl`.
- `illustrations/`: reusable native SVG illustrations and glyphs.
- `features/`: Leftovr-specific composed components such as `FoodCard`, `ShelfRow`, `EatFirstShelf`, `PremiumSheet`, `RecipeCard`, review cards, and retention cards.

Example:

```tsx
import { Button, FoodCard, Screen, Text } from "../src/components";
import { colors, spacing } from "../src/theme";
```

