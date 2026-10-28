# Little Elsewhere · A Pocket World

**A tiny world that feels bigger the closer you look.**

Little Elsewhere is an original cozy, explorable 3D miniature planet, created from a reference-driven visual brief. It runs entirely in modern browsers, with a curved landscape, organic trees and flowers, animated butterflies, soft lighting, a friendly character, and six small discoveries.

## What you can do

- **Explore a real 3D globe** with drag-to-orbit, touch controls, scroll and pinch zoom, camera reset, and smoothly animated close-up landmark views.
- **Visit six original landmarks:** the Daydream Bench, Whispering Waters, Butterfly Meadow, Story Tree, Firefly Grove, and Secret Picnic.
- **Interact with the environment:** greet Pip, make ripples in the pond, wake flowers, read short stories, light lanterns, and discover a hidden picnic.
- **Watch a living landscape:** swaying trees, hand-placed miniature structures, fluttering butterflies, glowing beacons and fireflies, floating pollen, and responsive water ripples.
- **Change the time of day** and explore a calm lantern-lit atmosphere at night.
- **Keep track of discoveries:** your six completed wonders are saved with `localStorage`. If storage is unavailable, the game still plays and tracks progress until you leave.
- **Play on desktop or mobile:** mouse, keyboard, touchscreen, and responsive overlays are supported.

## Stack

- Three.js + WebGL: real-time 3D scene, terrain, meshes, lighting, animation, selection raycasting.
- TypeScript: typed world, camera, model, gameplay, and UI systems.
- Vite: local development and optimized production build.
- HTML and CSS: responsive application shell and interface.
- No authentication, paid service, external API, or proprietary model dependencies.
- Procedural 3D art (no external 3D downloads or asset licensing required).

The optional Google Fonts used for headings and body text will fall back to local fonts if unavailable.

## Run locally

Requirements: **Node.js 20.19+** and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

To create a production build:

```bash
npm run typecheck
npm run build
npm run preview
```

`npm run build` produces a static site in `dist/`.

## Deploy on Vercel

1. Push this project to your GitHub repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Vercel normally detects the Vite setup. If prompted, choose **Vite**.
4. Set **Build Command:** `npm run build` and **Output Directory:** `dist`.
5. Deploy. No environment variables or paid plan are necessary.

You can also deploy the resulting `dist/` directory to Netlify, Cloudflare Pages, or a static hosting service.

## Controls

| Action | Desktop | Touchscreen |
| --- | --- | --- |
| Spin planet | Left mouse drag | Swipe or drag with one finger |
| Move viewpoint | Arrow keys | Drag planet |
| Zoom | Mouse wheel, +/- keys, +/- HUD buttons | Pinch, +/- HUD buttons |
| Visit landmark | Click glowing landmark / journal entry | Tap landmark / journal entry |
| Return to overview | Home or house button | House button |
| Toggle day/night | Sun/moon button | Sun/moon button |
| Discovery journal | Journal button or J | Journal button |
| Close overlays | Escape / × | × |

## Project structure

```text
pocket-world/
├── public/
│   └── favicon.svg
├── src/
│   ├── game/
│   │   ├── CameraRig.ts       # orbit/pinch/zoom/focus/transitions
│   │   └── Game.ts            # renderer, lighting, picking, main loop
│   ├── ui/
│   │   └── UI.ts              # HUD, journal, story and settings
│   ├── utils/
│   │   └── math.ts            # seeded world geometry helpers
│   ├── world/
│   │   ├── Models.ts          # original procedural 3D props and creatures
│   │   ├── Planet.ts          # displaced spherical terrain and surface water
│   │   └── World.ts           # world population, activity and discovery state
│   ├── main.ts
│   └── styles.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Customizing

- **Landmarks and dialog:** edit `PLACES` at the beginning of `src/world/World.ts`.
- **Planet colors and terrain:** `src/world/Planet.ts` and `src/utils/math.ts`.
- **Characters, structures and trees:** `src/world/Models.ts`.
- **Population density:** adjust the flower/tree/butterfly loops in `src/world/World.ts`.
- **Camera defaults:** `src/game/CameraRig.ts`.
- **Day/night and rendering:** `src/game/Game.ts`.
- **UI color and fonts:** CSS custom properties at the top of `src/styles.css`.

## Performance notes

Repeated shrubs and flowers use instanced mesh batches. Geometry and materials are shared where practical. Pixel density is capped, the shadow map is bounded, and animation timing is delta-based. On very old mobile devices, reducing the tree count in `World.ts` or disabling shadows in `Game.ts` can further improve speed.

The game is intended for modern WebGL-enabled browsers. Interactions use invisible 3D selection volumes for larger mobile tap targets. On an unsupported browser, the interface displays a WebGL fallback notice.

## Creative and asset notes

The supplied reference images informed the **miniature spherical-world composition**, rounded botanical silhouettes, warm pastel atmosphere, small props and cozy mood. Characters, landmark layouts, geometry, interface, text and behavior were created as new original material rather than copying the source artwork.

All scene content is generated at runtime. No user data is sent to a server, and the only persistence is the local discovery list in your browser.
