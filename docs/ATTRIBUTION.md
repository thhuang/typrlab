# Attribution & acknowledgements

typr is an independent, from-scratch implementation. Its design was informed by
studying how effective adaptive typing trainers work.

## keybr.com

- Project: https://www.keybr.com/ · Source: https://github.com/aradzie/keybr.com
- Author: Aleksei Radzievski · License: AGPL-3.0

How it was used: as a **behavioral and algorithmic reference**. typr's mechanics
were derived from keybr's documented and observable behavior, and from reading
its open-source code to verify how those mechanics work. **No keybr source code
was copied or incorporated into typr.** Every typr module — phonetic generation,
adaptive unlocking, per-key and per-transition statistics, and the analysis
views — is an original implementation, and several deliberately differ from
keybr (for example, accuracy-aware unlocking and bigram/transition targeting).

The analytical study notes produced during research
([`keybr-explainer.md`](keybr-explainer.md),
[`keybr-verified-claims.json`](keybr-verified-claims.json)) describe keybr's
behavior; they are not derived from any copyrighted text.

With gratitude to keybr.com for demonstrating how effective adaptive, generated
typing practice can be.
