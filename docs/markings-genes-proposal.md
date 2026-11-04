# Sabretooth: Undercoat & Markings — Gene Proposal (v0.1, **APPROVED** by Director 2026-11-05, folded into genetics-spec v0.4; kept as a record)
Owner: Tundra (genes, inheritance, rarity). Masks, stack and feasibility: Ochre, in **`docs/art/markings-proposal.md` v0.1**, which wins on art. Code: Flint. Names: Saga.
Builds on genetics-spec v0.3 (§1 loci, §3 inheritance, §3.5 tiers). **Folded into genetics-spec v0.4. genetics-spec is now the source of truth; don't edit this file.** Rulings: retune approved; points stay uncommon (9%); facial mask and ticking join the normal-Style creator when their art exists.

## 0. Rules
0.1 Every item is a grayscale mask on the fixed lineart, tinted by gene colour, with intensity setting opacity. There are no lineart changes. Each item needs one mask per pose (Ochre's doc).
0.2 **At most one body pattern per cat** (they turn to mud stacked), so body patterns are alleles of **one locus**. Overlays stack freely, and each is its **own locus**.
0.3 **No tail rings:** the bobtail is too short to read (Ochre).
0.4 Stack (Ochre): shadow, base_coat, **undercoat, ticking, body pattern, dorsal, points, mask, tearlines**, white, eyes, sabers, scars, age_elder, lineart. This replaces the genetics §2.3 stack once adopted.
0.5 Melanistic: every pattern and overlay draws as ghost markings, a shade off black and rim-lit. Leucistic: patterns are nearly invisible by design (Ochre). Genes still carry them, so they can be bred back out.
0.6 All inheritance is Mendelian (genetics §3.1), loci are independent, and the 0.5% per-locus mutation (§3.2) applies to every new locus.

## 1. Genes
| # | Item (layer) | Locus id | Alleles (founder freq) | Dominance | Phenotype % (HW) | Tier |
|---|---|---|---|---|---|---|
| 1.1 | Undercoat colour (`undercoat`) | `under` | `cream` .35, `pale` .25, `off` .40 | C: cream > pale > off | cream 57.7, pale 26.2, off (matches base, no layer) 16.0 | common |
| 1.2 | Undercoat intensity | `underInt` | `U+` .5, `U-` .5 | D (count U+) | opacity 0.35 / 0.60 / 0.85 = 25 / 50 / 25 | common |
| 1.3 | Body pattern (`markings_*`) | `marking` (existing locus, one allele added) | `spotted` .25, `rosette` .10, `barred` .08, `faintstripe` .17, `plain` .40 | C: spotted > rosette > barred > faintstripe > plain | spotted 43.8, rosette 14.0, faintstripe 16.5, plain 16.0, barred 9.8 | barred uncommon; others common |
| 1.4 | Dorsal stripe (`markings_dorsal`) | `dorsal` (existing) | `Ds` .012, `ds` .988 | C: Ds dominant | 2.4 | rare |
| 1.5 | Ticking (`ticking`) | `tick` | `Tk` .10, `tk` .90 | C: Tk dominant | 19.0 | common |
| 1.6 | Points (`points`) | `points` | `Pt` .70, `pt` .30 | C: Pt (none) > pt; shows when pt/pt | 9.0 | uncommon |
| 1.7 | Facial mask (`mask`) | `mask` | `Mk` .08, `mk` .92 | C: Mk dominant | 15.4 | common |
| 1.8 | Tear lines (`tearlines`) | `tear` | `Tl` .85, `tl` .15 | C: Tl (none) > tl; shows when tl/tl | 2.25 | rare |

1.9 **Intensity:** the existing `intensity` locus (I+/I-, opacity 0.35/0.60/0.85) sets opacity for the body pattern **and every overlay**, so there's one "boldness of markings" gene. Undercoat has its own `underInt`, because a pale belly and bold spots are independent in real cats.
1.10 **Tints** (placeholders; Ochre's palette wins, no hex work now):
   - Undercoat `cream` = mix(coat tint, `#F3EBDD`, 0.5), and `pale` = mix(coat, `#F3EBDD`, 0.25).
   - Every pattern and overlay uses the marking tint rule from genetics §2 (coat × 0.55; melanistic/leucistic special cases).
   - Ticking is drawn at 0.6 × intensity opacity, because it's fine grain.
1.11 The Rosette allele already exists in genetics v0.3. Only the mask is new (Ochre). The marking frequencies are retuned to make room for `barred`: faintstripe .20 → .17, plain .45 → .40.

## 2. Inheritance and data
2.1 Genotype additions: `loci.under`, `loci.underInt`, `loci.tick`, `loci.points`, `loci.mask`, `loci.tear`, each a 2-allele array like the other loci.
2.2 Resolver `traits` additions: `undercoat: "cream"|"pale"|"off"`, `undercoatInt: 0..2`, `ticking`, `points`, `mask` and `tearlines` as booleans. `marking` gains `barred`.
2.3 **World-gen draw order:** the new loci are rolled **after** `het`, on their own sub-stream (`markings`), so existing seeds reproduce (same pattern as world-gen v0.3.3).
2.4 **Creator:** phase 1 doesn't expose the new loci. The creator writes `under [off,off]`, `underInt [U-,U-]`, `tick [tk,tk]`, `points [Pt,Pt]`, `mask [mk,mk]`, `tear [Tl,Tl]`, and `marking` as before. Later, common items (undercoat, ticking, mask) can become creator rows, and uncommon/rare ones (barred, points, tear lines) go to Sandbox with Free Customization On.

## 3. Phasing
| Phase | Items | Why |
|---|---|---|
| **Phase 1** (first post-PoC art pass) | Undercoat (`under` + `underInt`), rosette mask (allele exists), barred (new allele), dorsal mask (locus exists) | The biggest visual gain for the fewest masks. Undercoat lifts every cat. Rosette and dorsal are already in the genes and only miss art. |
| **Later** | Ticking, points, facial mask, tear lines | Pure overlays. Each is an independent new locus, so it can be added one at a time with no reshuffle (own stream, §2.3). |

   Until an item's mask exists, its gene is still rolled and stored, and the resolver skips the missing layer (genetics §2 fallback). Cats then gain the look automatically when the art lands.

## 4. Open questions (closed by Director, 2026-11-05)
4.1 Approve folding this into genetics-spec v0.4, including the marking frequency retune (§1.11)?
4.2 Should points be uncommon (9%, current) or common?
4.3 Should any of the later overlays (mask or ticking) join the normal-Style creator once their art exists?

## Changelog
- v0.1 approved (2026-11-05, Director): marked APPROVED and folded into genetics v0.4. 4.1 yes, 4.2 uncommon, 4.3 mask + ticking join the normal creator when their art lands. Backup: `markings-genes-proposal.v0.1.bak.md`.
- v0.1 (2026-11-04, Tundra): first draft aligned to Ochre's markings-proposal v0.1.
