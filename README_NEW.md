# p4-tools-starter

A Phaser 4 + TypeScript + Vite starter focused on real-time FX experimentation.

This project currently includes:

- A Phaser 4 app bootstrapped from `src/main.ts`
- A `Boot` scene that immediately starts the `Main` scene
- A `Main` scene with a simple center-screen placeholder and an in-game FX manager
- A DOM-based FX editor overlay that can be toggled with `F2`
- Three FX pipeline examples:
  - Pixi shockwave filter pipeline
  - regl fullscreen pipeline
  - Three.js post-processing pipeline
- Basic passthrough shader assets for the regl pass

## What It Does

The current app renders a simple starter scene and layers an editable FX control panel on top of it.

The editor lets you:

- Toggle FX passes on and off
- Reorder passes with Up and Down controls
- Adjust exposed uniforms live
- Save the current pipeline state as JSON
- Load a JSON preset back into the editor
- Reset all exposed uniforms to their defaults

## Tech Stack

- Phaser 4
- TypeScript
- Vite
- PixiJS shockwave filter
- regl
- Three.js post-processing

## Project Structure

```text
src/
├── main.ts
├── game/
│   ├── config.ts
│   └── scenes/
│       ├── Boot.ts
│       └── Main.ts
├── fx/
│   ├── FXManager.ts
│   ├── FXPass.ts
│   ├── pixi/
│   │   └── PixiFilterPipeline.ts
│   ├── regl/
│   │   └── ReglPipeline.ts
│   └── three/
│       └── ThreePipeline.ts
├── shaders/
│   └── basic/
│       ├── passthrough.vert
│       └── passthrough.frag
└── ui/
    └── FXEditor.ts
```

## Running Locally

Install dependencies once:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the app in your browser at:

```text
http://127.0.0.1:5173/
```

Build a production bundle:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Controls

- `F2` toggles the FX editor panel
- The editor header can be dragged
- The panel can be resized from the bottom-right corner

## Notes

- The Three.js pipeline currently falls back safely on WebGL1-only environments.
- The FX editor is currently DOM-based and overlaid on top of the Phaser canvas.
- The project is set up for experimentation and can be extended with more passes, uniforms, and preset formats.

## License

MIT
