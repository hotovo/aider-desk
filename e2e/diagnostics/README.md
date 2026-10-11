# LegendList measurement reproduction

Run from the repository root:

```sh
node e2e/diagnostics/legend-list-repro.mjs
```

Requires the installed project dependencies and Playwright Chromium. If the browser is missing, install it with `npx playwright install chromium`.

The runner uses esbuild and headless Chromium to exercise the real React and LegendList 3.6.0 layout path. It reads the installed patched module and reverses the committed patch in memory to produce an unpatched baseline. It tests the installed repaired patch and production activation hook directly, and reconstructs both the old item-size flip guard and the deferral-only patch as regression controls. It never writes to node_modules or changes the production patch.

## Scenarios

- **Feedback:** the size-change callback changes the item height between 800 and 801 pixels, up to 80 updates. This deliberately creates a bounded synchronous measurement/content feedback loop. It reproduces the React maximum-update-depth error without mocking React, LegendList, or DOM geometry.
- **Visibility:** hide the mounted list with display:none, update its content while hidden, show it again, and request another content render. This exercises the valid 800 -> 0 -> 800 measurement sequence.
- **Remount:** mount a new list instance with the same message ID and height. This checks whether module-global measurement history contaminates the new list.
- **Finished while hidden:** grow content through three updates while hidden, then show the task without any further content update. Check that hidden measurements preserve the last valid cached height, activation restores the final measured height, and a following task scrolls to the new end.
- **Paused anchor:** scroll a 20-item list to a message with a 30-pixel offset, hide it, change item heights, and show it again. The production activation hook must preserve the message and offset instead of scrolling to the end.
- **Settling bottom:** wrap the real scroll-to-end request to hold restoration open while the item grows by 300 pixels and its DOM measurements settle. A control without the completion callback must retain the 300-pixel bottom gap; the repaired version must align to the settled bottom on the final frame. This exercises layout changes rather than a new message update.

The runner reports browser errors, update counts, accepted hidden measurements, live known/applied sizes, total list size, actual DOM height, and scroll metrics. Assertions require the unpatched feedback baseline to crash, the flip-guard baseline to produce inconsistent sizing, and the deferral-only baseline to corrupt cached heights while hidden. The repaired version must preserve hidden caches, recover final sizes without another content update, retain the paused anchor, and avoid the original crash.

This is a controlled reproduction of the measurement-loop mechanism, not a replay of the original diff-dropdown interaction or a full AiderDesk task-switch reproduction. The production repair retains animation-frame deferral, rejects unmeasurable 0×0 containers before changing size caches or measurement baselines, and refreshes measurements when an inactive task becomes visible. Refreshing uses the existing list instance and restores either its paused message anchor or its following position at the end. Once restoration finishes, a cancellable final animation frame aligns following conversations using the settled DOM height, excluding temporary list padding; paused conversations are not realigned. Cancellation and coalescing of LegendList’s internal deferred measurements are outside this repair.
