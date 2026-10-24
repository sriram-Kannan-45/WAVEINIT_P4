import test from "node:test";
import assert from "node:assert/strict";
import { useCart, type CartItem } from "../src/store/cart-store";

type TestFormState = {
  name: string;
  price: number;
  variants: { size: string; stock: number }[];
};

class FormHistoryEngine<T extends Record<string, unknown>> {
  private past: T[] = [];
  private future: T[] = [];
  private present: T;
  private maxDepth: number;

  constructor(initial: T, maxDepth = 30) {
    this.present = JSON.parse(JSON.stringify(initial));
    this.maxDepth = maxDepth;
  }

  takeSnapshot(nextVal: T) {
    const currentStr = JSON.stringify(this.present);
    const nextStr = JSON.stringify(nextVal);
    if (currentStr === nextStr) return;

    this.past.push(JSON.parse(currentStr));
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.present = JSON.parse(nextStr);
    this.future = [];
  }

  undo(): T | null {
    if (this.past.length === 0) return null;
    const previous = this.past.pop()!;
    this.future.unshift(JSON.parse(JSON.stringify(this.present)));
    this.present = JSON.parse(JSON.stringify(previous));
    return this.present;
  }

  redo(): T | null {
    if (this.future.length === 0) return null;
    const next = this.future.shift()!;
    this.past.push(JSON.parse(JSON.stringify(this.present)));
    this.present = JSON.parse(JSON.stringify(next));
    return this.present;
  }

  get state() {
    return {
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      undoCount: this.past.length,
      redoCount: this.future.length,
      current: this.present,
    };
  }
}

test("Undo/Redo: tracks sequential state progression and allows step-by-step undo", () => {
  const initial: TestFormState = {
    name: "Banarasi Silk Saree",
    price: 3499,
    variants: [{ size: "Free Size", stock: 10 }],
  };

  const history = new FormHistoryEngine<TestFormState>(initial);
  assert.equal(history.state.canUndo, false);
  assert.equal(history.state.canRedo, false);

  // Edit 1: change name
  history.takeSnapshot({ ...initial, name: "Royal Banarasi Silk Saree" });
  assert.equal(history.state.canUndo, true);
  assert.equal(history.state.undoCount, 1);
  assert.equal(history.state.current.name, "Royal Banarasi Silk Saree");

  // Edit 2: add a variant
  history.takeSnapshot({
    ...initial,
    name: "Royal Banarasi Silk Saree",
    variants: [
      { size: "Free Size", stock: 10 },
      { size: "Plus Size", stock: 5 },
    ],
  });
  assert.equal(history.state.undoCount, 2);
  assert.equal(history.state.current.variants.length, 2);

  // Undo edit 2
  const undone1 = history.undo();
  assert.ok(undone1);
  assert.equal(undone1.variants.length, 1);
  assert.equal(undone1.name, "Royal Banarasi Silk Saree");
  assert.equal(history.state.canRedo, true);
  assert.equal(history.state.redoCount, 1);
  assert.equal(history.state.undoCount, 1);

  // Undo edit 1 (back to initial)
  const undone2 = history.undo();
  assert.ok(undone2);
  assert.equal(undone2.name, "Banarasi Silk Saree");
  assert.equal(history.state.canUndo, false);
  assert.equal(history.state.canRedo, true);
  assert.equal(history.state.redoCount, 2);

  // Redo edit 1
  const redone1 = history.redo();
  assert.ok(redone1);
  assert.equal(redone1.name, "Royal Banarasi Silk Saree");
  assert.equal(history.state.canUndo, true);
  assert.equal(history.state.canRedo, true);

  // Redo edit 2
  const redone2 = history.redo();
  assert.ok(redone2);
  assert.equal(redone2.variants.length, 2);
  assert.equal(history.state.canRedo, false);
});

test("Undo/Redo: new discrete edits invalidate redo future stack", () => {
  const initial = { count: 0 };
  const history = new FormHistoryEngine(initial);

  history.takeSnapshot({ count: 1 });
  history.takeSnapshot({ count: 2 });
  history.undo(); // back to 1
  assert.equal(history.state.canRedo, true);

  // Making a new change branches history and invalidates future
  history.takeSnapshot({ count: 99 });
  assert.equal(history.state.canRedo, false);
  assert.equal(history.state.redoCount, 0);
  assert.equal(history.state.current.count, 99);

  history.undo();
  assert.equal(history.state.current.count, 1);
});

test("Undo/Redo: enforces maxDepth boundary and avoids redundant snapshots", () => {
  const history = new FormHistoryEngine({ step: 0 }, 3);

  history.takeSnapshot({ step: 1 });
  history.takeSnapshot({ step: 2 });
  history.takeSnapshot({ step: 3 });
  history.takeSnapshot({ step: 4 }); // pushes past depth limit 3

  assert.equal(history.state.undoCount, 3);

  // Redundant snapshot with identical value is ignored
  history.takeSnapshot({ step: 4 });
  assert.equal(history.state.undoCount, 3);
});

test("Cart Store Undo/Redo: tracks user operations and correctly rolls back/forward", () => {
  // Reset store to known state
  useCart.setState({
    items: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
  });

  const item1: CartItem = {
    product_id: "prod-1",
    variant_id: "var-1",
    slug: "banarasi-saree",
    name: "Banarasi Silk Saree",
    size: "Free Size",
    image: "https://example.com/saree.jpg",
    price: 3499,
    quantity: 1,
    stock: 10,
  };

  const item2: CartItem = {
    product_id: "prod-2",
    variant_id: "var-2",
    slug: "chanderi-kurta",
    name: "Chanderi Kurta Set",
    size: "M",
    image: "https://example.com/kurta.jpg",
    price: 2199,
    quantity: 1,
    stock: 5,
  };

  // 1. Add item1
  const ok1 = useCart.getState().add(item1);
  assert.equal(ok1, true);
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().canUndo, true);
  assert.equal(useCart.getState().undoCount, 1);
  assert.equal(useCart.getState().canRedo, false);

  // 2. Add item2
  const ok2 = useCart.getState().add(item2);
  assert.equal(ok2, true);
  assert.equal(useCart.getState().items.length, 2);
  assert.equal(useCart.getState().undoCount, 2);

  // 3. Set quantity of item1 to 2
  useCart.getState().setQuantity("var-1", 2);
  assert.equal(
    useCart.getState().items.find((i) => i.variant_id === "var-1")?.quantity,
    2,
  );
  assert.equal(useCart.getState().undoCount, 3);

  // 4. Undo quantity change
  const undoRes1 = useCart.getState().undo();
  assert.equal(undoRes1, true);
  assert.equal(
    useCart.getState().items.find((i) => i.variant_id === "var-1")?.quantity,
    1,
  );
  assert.equal(useCart.getState().canRedo, true);
  assert.equal(useCart.getState().redoCount, 1);

  // 5. Redo quantity change
  const redoRes1 = useCart.getState().redo();
  assert.equal(redoRes1, true);
  assert.equal(
    useCart.getState().items.find((i) => i.variant_id === "var-1")?.quantity,
    2,
  );

  // 6. Remove item2
  useCart.getState().remove("var-2");
  assert.equal(useCart.getState().items.length, 1);
  assert.equal(useCart.getState().items[0].variant_id, "var-1");

  // 7. Undo removal -> item2 is restored
  const undoRes2 = useCart.getState().undo();
  assert.equal(undoRes2, true);
  assert.equal(useCart.getState().items.length, 2);
  assert.ok(useCart.getState().items.some((i) => i.variant_id === "var-2"));

  // 8. Reconcile from backend (price/stock refresh) does NOT alter history stacks
  const pastBefore = useCart.getState().past.length;
  useCart.getState().reconcile([
    { variant_id: "var-1", price: 3999, stock: 8, available: true },
  ]);
  assert.equal(
    useCart.getState().items.find((i) => i.variant_id === "var-1")?.price,
    3999,
  );
  assert.equal(useCart.getState().past.length, pastBefore);

  // 9. Clear cart
  useCart.getState().clear();
  assert.equal(useCart.getState().items.length, 0);

  // 10. Undo clear cart -> bag restored
  const undoRes3 = useCart.getState().undo();
  assert.equal(undoRes3, true);
  assert.equal(useCart.getState().items.length, 2);
});
