# Saga copy notes for the full review (v0.1.8)

Copy source: /workspace/saga-narrative-voice/ui/ui-copy-v1.json (follows UX v0.1.5, 66eaeb7). Tutorial copy: tutorial/tips-copy-v2.json.

1. **Lore placeholders (high).** "{name} leads Bonefield Pride" ships unfilled. Every Lore fact line needs its tokens filled from the save, or the line hidden until it's known. I'll rewrite any Lore line that can't be filled into a version without the token.
2. **Leftover helper lines (high).** "Rerolls personality only. Your look and name stay." and "Room for more" confused Anna. Remove them, or put the reroll note only on a real reroll button: "Reroll personality. Your look and name stay the same."
3. **Greyed sections and actions (medium).** The opens-when lines, the "New: {section}" toast, the "Locked" label and tip.place.unavailable are written in ui-copy-v1. Check that the build uses them and not code fallbacks.
4. **Appearance step (medium).** Each look choice needs a one-line note. Suggested: "This changes how the story describes you. Your portrait stays the same."
5. **Trait names (low).** Sickly Line now shows as Frail Blood. Den Mother shows as Den Father on males. Check that event and Lore text uses the same display names.
6. **Numbers in prose (ongoing).** Only labels may carry numbers, like the top bar "{Season} · Day {n}". Story, tips and Lore text stay number-free.
