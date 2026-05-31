# Font choice & reading/typing performance — what the evidence says

A deep, adversarially-verified research pass (109 agents) on whether typeface choice
actually affects on-screen reading/typing, to ground typr's font decisions. Every
finding below survived 3-vote verification; confidence and sources noted.

## Headline

**Typeface choice matters far less than size, spacing, and per-person fit.** For the
general population there is no reliable serif vs sans vs monospace difference in
reading speed, comprehension, or legibility. So picking fonts for popularity/looks
is legitimate — just don't promise a performance gain. The real levers are **size**
and **spacing**, and specific *populations* (low-vision, dyslexia) do benefit from
specific styles.

## Findings (all high-confidence, 3-0 verified)

1. **Serif vs sans-serif → no measurable difference** in reading speed, comprehension,
   or legibility, on paper *or* screen. The "sans-serif is better on screens" dogma is
   unsupported. — Richardson (2022), *Sans Serif*, Springer/OAPEN systematic review of
   ~140 years of research. <https://library.oapen.org/bitstream/id/165f35ac-584f-4a2e-ba84-6832faed7e69/978-3-030-90984-0.pdf>
2. **Monospaced vs proportional → no net reading-time cost.** Monospacing changes
   eye-movement patterns (more, shorter fixations) but total reading time is unchanged;
   the oculomotor system adapts. — IDS 2021. <https://ids-pub.bsz-bw.de/frontdoor/index/index/year/2021/docId/10276>
3. **No single font is fastest for everyone; matching font to the individual yields up
   to ~35% within-person speed gain** (232 vs 314 WPM) with no comprehension loss.
   *But* a reader's **preference does NOT predict** their fastest font. — Wallace et al.,
   ACM TOCHI 2022 (N=352). <https://dl.acm.org/doi/10.1145/3502222>
4. **Font SIZE is a primary driver.** ~18pt+ recommended for text-heavy on-screen
   reading; size affects comprehension too. Effective size is **x-height**, not nominal
   points. — Rello et al. CHI 2016 (N=104) <https://dl.acm.org/doi/10.1145/2858036.2858204>;
   Legge & Bigelow, J Vision 2011 <https://jov.arvojournals.org/article.aspx?articleid=2191906>
5. **Default spacing is ~optimal; widening hurts** — 2× standard letter-spacing cuts
   reading speed ~25%. — <https://pmc.ncbi.nlm.nih.gov/articles/PMC2729067/>
6. **"Special" fonts mostly fail to replicate.** Dyslexie/OpenDyslexic show no reading
   benefit (any tiny Dyslexie gain is from *spacing*, not letterforms); Sans Forgetica's
   memory boost did not exist across 4 experiments (~300 ppl). — Kuster et al.
   <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5934461/>; Sans Forgetica
   <https://link.springer.com/article/10.1186/s41235-022-00448-9>
7. **Population-specific effects are real.** For dyslexic readers, **sans-serif,
   monospaced, and roman (non-italic)** styles help; **italic significantly hurts** and
   should be avoided. Low-vision readers benefit from high-legibility designs
   (Atkinson-Hyperlegible-style). — Rello & Baeza-Yates 2016.
   <https://www.superarladislexia.org/pdf/2016-Luz%20Rello-Fonts-taccess.pdf>

## Implications for typr

- **Default:** a clean, well-sized, conventional font. A disambiguated **monospace** is
  well justified for a *typing* trainer: no reading penalty (finding 2), helps dyslexic
  readers (finding 7), and clear l/I/1·0/O glyphs reduce wrong-key recognition errors.
  typr defaults to **JetBrains Mono** — a disambiguated monospace (clear l/I/1 · 0/O)
  that also powers the UI chrome (`--font-mono`).
- **The real lever is SIZE** → offer an adjustable **text size** (the one change the
  evidence most strongly supports). typr's board is already ~24px+, above the 18pt floor.
- **Font picker = comfort/preference, not performance.** Keep it, but don't claim speed
  or accuracy gains (finding 3). Honest copy.
- **Don't widen letter-spacing** as a "readability" feature (finding 5).
- **Justified-by-evidence options:** Atkinson Hyperlegible (low-vision). Everything else
  on the shelf (Literata, Merriweather, Lora, Inter, Lexend, Cascadia Code, Source Code
  Pro) is fine to offer **for preference** — Lexend's reading-proficiency marketing is
  *not* independently replicated, so don't promise it.
- **Avoid italic** for the practice text (finding 7).
