import { beforeEach, describe, expect, it } from "vitest";
import { useGenerate } from "./generate";

/**
 * Per-job selection lives in this store rather than in the Generate screen's
 * component state. That placement is the fix, not an implementation detail:
 * as `useState` it was wiped whenever the screen unmounted, including when
 * the user followed the screen's own "configure credentials" link to
 * Settings — so doing what the app asked silently discarded the setup they
 * were part-way through.
 *
 * These tests pin the contract that placement has to satisfy. What they
 * cannot cover is that `index.tsx` actually reads from here rather than
 * reintroducing local state; that needs a React renderer, which would mean
 * jsdom plus a Tamagui test setup.
 */
describe("useGenerate — per-job selection", () => {
  beforeEach(() => {
    useGenerate.setState({
      selectionOverrides: {},
      selectionDirty: {},
      status: "idle",
      url: "",
      result: undefined,
      errorMessage: undefined,
    });
  });

  it("records both the value and the fact the field was touched", () => {
    useGenerate.getState().setSelectionField("sourceLang", "ja");
    const s = useGenerate.getState();
    expect(s.selectionOverrides.sourceLang).toBe("ja");
    // mergeGenerateSelection only honours an override when its dirty flag is
    // set, so forgetting this would silently make the override a no-op.
    expect(s.selectionDirty.sourceLang).toBe(true);
  });

  it("keeps fields independent", () => {
    const { setSelectionField } = useGenerate.getState();
    setSelectionField("sourceLang", "ja");
    setSelectionField("targetLang", "en");
    const s = useGenerate.getState();
    expect(s.selectionOverrides).toEqual({ sourceLang: "ja", targetLang: "en" });
    expect(s.selectionDirty).toEqual({ sourceLang: true, targetLang: true });
  });

  it("state outlives any one screen, which is what survives navigation", () => {
    useGenerate.getState().setSelectionField("sourceLang", "ja");
    // Nothing here unmounts anything — that is the point. Reading the module
    // again after arbitrary other work still sees the override.
    expect(useGenerate.getState().selectionOverrides.sourceLang).toBe("ja");
  });

  it("reset() clears the job but NOT the selection", () => {
    // reset() backs both "New transcription" and "Try again". Clearing
    // overrides here would mean a retry silently abandoned the settings the
    // user chose for the run that just failed — the same class of bug this
    // change set out to fix.
    const { setSelectionField, reset } = useGenerate.getState();
    setSelectionField("sourceLang", "ja");
    useGenerate.setState({ url: "https://youtu.be/x", errorMessage: "boom" });

    reset();

    const s = useGenerate.getState();
    expect(s.url).toBe("");
    expect(s.errorMessage).toBeUndefined();
    expect(s.selectionOverrides.sourceLang).toBe("ja");
    expect(s.selectionDirty.sourceLang).toBe(true);
  });

  it("clearSelection() drops every override", () => {
    const { setSelectionField, clearSelection } = useGenerate.getState();
    setSelectionField("sourceLang", "ja");
    setSelectionField("downloadOnly", true);

    clearSelection();

    const s = useGenerate.getState();
    expect(s.selectionOverrides).toEqual({});
    expect(s.selectionDirty).toEqual({});
  });

  it("clearSelection() leaves the job state alone", () => {
    // "New transcription" calls clearSelection() *and* reset(); each should
    // do only its own half.
    useGenerate.setState({ url: "https://youtu.be/x" });
    useGenerate.getState().setSelectionField("sourceLang", "ja");

    useGenerate.getState().clearSelection();

    expect(useGenerate.getState().url).toBe("https://youtu.be/x");
  });

  it("does not persist selection to storage", () => {
    // Session-scoped on purpose (this store has no `persist` middleware,
    // unlike useLibrary): overrides must not resurface days later against an
    // unrelated video. If someone adds persistence, this fails.
    const writes: string[] = [];
    const store = {
      getItem: () => null,
      setItem: (k: string) => writes.push(k),
      removeItem: () => undefined,
    };
    (globalThis as { localStorage?: unknown }).localStorage = store;
    try {
      useGenerate.getState().setSelectionField("sourceLang", "ja");
      expect(writes).toEqual([]);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
