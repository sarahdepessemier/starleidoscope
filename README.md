# Starleidoscope

An interactive spaceship cockpit built with Three.js (`WebGPURenderer`). The round window and the
picture frame show Shadertoy shaders that were ported to WGSL and run through TSL (`wgslFn`).

Live: https://sarahdepessemier.github.io/starleidoscope/

## Interaction
- **Mouse**: the point of view in the window follows the mouse (the camera also sways a little).
- **Click the red TELEPORT button** (or press **T**): flash, warp, and a new destination in the window.
  The picture frame previews the next destination (it does not react to the mouse).
- **S** scan (new colours) · **D** zoom · **F** new sky · **J** roll · **K** hold for warp. The keys are also clickable on screen.

## Shadertoy shaders used
| Destination | Shader | Author | Licence |
| --- | --- | --- | --- |
| Kaleidoscope Rift | https://www.shadertoy.com/view/ftt3R7 | (original author, see Shadertoy) | see Shadertoy |
| Aqua | https://www.shadertoy.com/view/Ds3XRl (Procedural Blue Planet) | Julien Sulpis | CC BY-NC-SA 3.0 |
| Rubra | https://www.shadertoy.com/view/msdXzl (Procedural Red Planet) | Julien Sulpis | CC BY-NC-SA 3.0 |
| Neon Gate | TODO: add Shadertoy URL | TODO | CC BY-NC 4.0 |
| The Vortex | TODO: add Shadertoy URL (tunnel, 2017) | Ethan Alexander Shulman | see Shadertoy |

All shaders were ported to WGSL (`src/shaders/`). Changes: noise textures replaced by procedural noise,
mouse-controlled camera, shared controls (roll, flash, colour shift, zoom, seed). This is a non-commercial school project.

## Run
```
npm install
npm run dev
npm run build
```
