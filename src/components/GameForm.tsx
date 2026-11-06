import { useState, type FormEvent } from "react";
import { validateGameForm, type GameDetails, type GameForm as GameFormValues } from "../data/addedGames";

const input =
  "mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-500";

/**
 * Name, year, and BGG link for adding or editing a game. `onSave` resolves once
 * saved, or throws with a message to show.
 */
export function GameForm(props: {
  initial: GameFormValues;
  submitLabel: string;
  onSave(details: GameDetails): Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(props.initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = (field: keyof GameFormValues) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const result = validateGameForm(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      await props.onSave(result.value);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="text-sm text-stone-300">Name</span>
        <input value={form.name} onChange={set("name")} required autoFocus className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-stone-300">
          Year <span className="text-stone-500">(optional)</span>
        </span>
        <input value={form.year} onChange={set("year")} inputMode="numeric" placeholder="e.g. 2021" className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-stone-300">
          BoardGameGeek link <span className="text-stone-500">(optional)</span>
        </span>
        <input
          value={form.bggLink}
          onChange={set("bggLink")}
          placeholder="https://boardgamegeek.com/boardgame/…"
          className={input}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-amber-500 px-5 py-2 font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {saving ? "Saving…" : props.submitLabel}
        </button>
        {props.onCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={props.onCancel}
            className="text-sm text-stone-400 underline hover:text-stone-200 disabled:opacity-40"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
