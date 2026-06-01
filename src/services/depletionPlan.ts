import { getDepletionUpdate, PartialState } from "./inventoryRules";
import { dimensionOf, toMetric } from "./units";

export type PlanLot = {
  id: string;
  quantity: number;
  partial_state: PartialState;
  unit: string;
  net_amount: number | null;
  net_unit: "ml" | "g" | null;
};

export type DepletionOp =
  | { kind: "remove"; id: string }
  | { kind: "setNet"; id: string; netAmount: number }
  | { kind: "setQuantity"; id: string; quantity: number }
  | { kind: "setPartial"; id: string; partialState: PartialState };

// Lots MUST be pre-sorted soonest-expiry first by the caller.
export function planDepletion(
  lots: PlanLot[],
  need: { amount: number; unit: string },
): DepletionOp[] {
  const ops: DepletionOp[] = [];
  const metric = toMetric(need.amount, need.unit);
  let remainingMetric =
    metric.dimension === "volume" || metric.dimension === "mass" ? metric.value : 0;
  let remainingCount = Math.max(1, Math.round(need.amount));

  for (const lot of lots) {
    const precise =
      lot.net_amount != null &&
      lot.net_unit != null &&
      (metric.dimension === "volume" || metric.dimension === "mass") &&
      metric.dimension === dimensionOf(lot.net_unit);

    if (precise) {
      if (remainingMetric <= 0) break;
      const consume = Math.min(lot.net_amount as number, remainingMetric);
      const next = (lot.net_amount as number) - consume;
      ops.push(
        next <= 0
          ? { kind: "remove", id: lot.id }
          : { kind: "setNet", id: lot.id, netAmount: Number(next.toFixed(2)) },
      );
      remainingMetric -= consume;
      continue;
    }

    if (remainingCount <= 0) break;
    if (lot.quantity > 1) {
      const consume = Math.min(lot.quantity, remainingCount);
      const nextQ = lot.quantity - consume;
      ops.push(
        nextQ <= 0
          ? { kind: "remove", id: lot.id }
          : { kind: "setQuantity", id: lot.id, quantity: nextQ },
      );
      remainingCount -= consume;
    } else {
      const d = getDepletionUpdate(lot, 1);
      ops.push(
        d.shouldRemove
          ? { kind: "remove", id: lot.id }
          : { kind: "setPartial", id: lot.id, partialState: d.partialState },
      );
      remainingCount -= 1;
    }
  }

  return ops;
}
