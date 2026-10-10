# LegendList measurement reproduction

Run from the repository root:

```sh
node e2e/diagnostics/legend-list-repro.mjs
```

Requires the installed project dependencies and Playwright Chromium. If the browser is missing, install it with `npx playwright install chromium`.

The runner uses esbuild and headless Chromium to exercise the real React and LegendList 3.6.0 layout path. It reads the installed patched module and reverses the committed patch in memory to produce an unpatched baseline. It tests the installed repaired patch directly and reconstructs the old item-size flip guard in memory as a known-bad regression control. It never writes to node_modules or changes the production patch.

## Scenarios

- **Feedback:** the size-change callback changes the item height between 800 and 801 pixels, up to 80 updates. This deliberately creates a bounded synchronous measurement/content feedback loop. It reproduces the React maximum-update-depth error without mocking React, LegendList, or DOM geometry.
- **Visibility:** hide the mounted list with display:none, update its content while hidden, show it again, and request another content render. This exercises the valid 800 -> 0 -> 800 measurement sequence.
- **Remount:** mount a new list instance with the same message ID and height. This checks whether module-global measurement history contaminates the new list.

The runner reports browser errors, update counts, live known/applied sizes, total list size, and actual DOM height. Assertions require the unpatched feedback baseline to crash, the reconstructed flip-guard baseline to produce inconsistent sizing in all three scenarios, and the installed repaired patch to complete all scenarios without errors or sizing inconsistencies.

This is a controlled reproduction of the measurement-loop mechanism, not a replay of the original diff-dropdown interaction or a full AiderDesk task-switch reproduction. The production repair removes only the faulty flip guard and retains the existing animation-frame deferral. Cancellation and coalescing of deferred measurements are outside this minimal repair.
