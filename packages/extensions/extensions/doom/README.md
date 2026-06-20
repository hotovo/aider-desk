# Doom Extension

Plays [DOOM](https://en.wikipedia.org/wiki/Doom_(1993_video_game)) in a floating panel within AiderDesk.

> Based on [pi-doom](https://github.com/badlogic/pi-doom) by [Mario Zechner (badlogic)](https://github.com/badlogic).

## Features

- **Full DOOM gameplay** rendered directly in the AiderDesk UI
- **WebAssembly powered** — DOOM compiled to WASM via Emscripten, running in the renderer process
- **Crisp pixelated canvas rendering** at native DOOM resolution (640×400)
- **Keyboard input support** with WASD, arrow keys, and full control mapping
- **Offline-ready** — assets are cached in IndexedDB after the first load (~5 MB total)

## How It Works

The extension loads a WebAssembly port of [doomgeneric](https://github.com/ozkl/doomgeneric) directly in the renderer process. The game engine runs as a WASM module, rendering each frame to an in-memory framebuffer. The framebuffer is then copied to an HTML `<canvas>` and displayed in a floating panel.

1. **DOOM** runs as a WebAssembly module (compiled from C via Emscripten)
2. Each frame, DOOM renders to a 640×400 framebuffer
3. The framebuffer is converted from ARGB to RGBA and drawn to a `<canvas>` element
4. Keyboard input is mapped from browser key codes to DOOM key codes

## Controls

| Action            | Keys           |
| ----------------- | -------------- |
| Move Forward/Back | W / S or ↑ / ↓ |
| Strafe            | A / D          |
| Turn              | ← / →          |
| Fire              | F              |
| Use/Open          | Space          |
| Run               | Shift          |
| Weapons           | 1–7            |
| Menu              | Escape         |
| Map               | Tab            |

Click the game area to capture keyboard input. Click away to release.

## Credits

- [id Software](https://github.com/id-Software/DOOM) for the original DOOM source release
- [doomgeneric](https://github.com/ozkl/doomgeneric) for the portable DOOM implementation
- [Emscripten](https://emscripten.org/) for the C-to-WebAssembly compiler toolchain
- [Mario Zechner (badlogic)](https://github.com/badlogic) for the [pi-doom](https://github.com/badlogic/pi-doom) extension — prebuilt WASM binaries and shareware WAD that this extension is based on
