<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- 3D cube is an imperative three.js engine (src/lib/cube/engine.ts) loaded via dynamic import from Cube3D; custom gestures need full control over raycasting vs. view rotation.
- Logical cube state lives in vendored cubejs (src/vendor/cubejs, patched to avoid CJS `this`); every move updates logical state and engine queue together.
- Preserve vendored cubejs initialization scripts, stylesheets, and error-capture registration in package sideEffects; production tree shaking must not remove required import-time setup.
- Solver/scrambler run in a Web Worker (src/lib/cube/solver.worker.ts) because Kociemba table init blocks ~2s.
- All data stays local (idb-keyval); no backend — the app must work offline.
- Service worker via vite-plugin-pwa generateSW, registered only from src/lib/pwa.ts with preview/iframe guards; runtime caches warmed after first control.
- All user turns enter the timer hook before logical/visual move application; inspection penalties are captured at that instant and recorded on stop, so orbit and generated scrambles never start timing.
- Cube appearance reads semantic cube palette tokens from global CSS; layer animations carry frame time through the queue without dropping turns, and the inner core stays inside the center cubie to avoid intersecting moving layers.
- Camera snapping and keyboard face mapping use the 24 proper cube orientations to prevent duplicate axes; rigid snapping is gated by laptop width and fine hover-capable pointer, never touch-only tablets.
