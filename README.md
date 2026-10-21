# Starleidoscope

An interactive spaceship cockpit built with Three.js (`WebGPURenderer`). The round window and the
picture frame show Shadertoy shaders that were ported to WGSL and run through TSL (`wgslFn`).
Fly to a new destination with the red teleport button, and use the control panel to change what you see in the window.

Live: https://sarahdepessemier.github.io/starleidoscope/

## How to use it

An instruction panel is shown on screen when the page opens (and behind the **? HELP** button, top right).

| What | How | Key | Effect |
| --- | --- | --- | --- |
| Look around | move the **mouse** | | the point of view in the window follows the mouse (the camera also sways a little) |
| **Teleport** | click the big **red button** | `T` | flash + warp, then a new destination in the window. The picture frame always shows the next destination |
| **Colours** | click the **rotary knob** | `S` | changes the colours (random star colours, hue shift on the planets and nebulae) |
| **Zoom** | drag the **slider** | `D` | zooms the window in and out (the key cycles through three zoom levels) |
| **Randomise** | flip the **toggle switch** | `F` | a brand-new random sky / planet in the current destination |
| **Roll** | drag the **joystick** sideways | `J` | rolls the view, springs back when you let go (the key gives a gentle kick) |
| **Warp speed** | drag the **slider** along its slot | `K` | the further towards you, the faster you fly (holding `K` pushes it to maximum) |
| Loose objects | **drag** the mug, pen, dice or clipboard | | zero-gravity physics: grab them, throw them, watch them float. Teleporting shakes everything loose |

The controls only change what is shown in the **window**. The **picture frame** is a calm preview of the next
destination: it does not react to the mouse or to any control. Every visit (and every teleport) shows a different, random sky.

## Techniques
- **Three.js `WebGPURenderer`** with TSL: every shader is a WGSL function wrapped with `wgslFn` and used as the `colorNode` of a `MeshBasicNodeMaterial`.
- **7 Shadertoy shaders** ported to WGSL, all sharing one set of uniforms (time, mouse, roll, zoom, colour shift, seed, flash).
- **Rapier** (`@dimforge/rapier3d-compat`) for the zero-gravity physics: colliders for the console, walls and objects, drag-and-throw with the mouse, and a soft "leash" that keeps floating objects inside the camera view.
- **Bloom post-processing** with three's TSL `RenderPipeline` and `BloomNode` (`three/addons/tsl/display/BloomNode.js`): bright parts (LEDs, the window, the red button) glow, and the glow flares with scans and teleports. Add `?bloom=0` to the url to switch it off.
- A cockpit built entirely in code (no model files): walls with a round window, a console with ~700 blinking LED buttons, gauges, a picture frame, a mug, a clipboard, a pen and dice.
- Raycasting for the 3D controls (click, drag, hold) and the physics grabbing.

## Shadertoy shaders used
| Destination | Shader | Author | Licence |
| --- | --- | --- | --- |
| Kaleidoscope Rift | https://www.shadertoy.com/view/ftt3R7 | DanielXMoore | no licence stated in the code (Shadertoy default: CC BY-NC-SA 3.0) |
| Aqua | https://www.shadertoy.com/view/Ds3XRl (Procedural Blue Planet) | Julien Sulpis | CC BY-NC-SA 3.0 |
| Rubra | https://www.shadertoy.com/view/msdXzl (Procedural Red Planet) | Julien Sulpis | CC BY-NC-SA 3.0 |
| Star Nest | https://www.shadertoy.com/view/XlfGRj | Kali (Pablo Roman Andrioli) | MIT |
| The Vortex | https://www.shadertoy.com/view/XdBBDz | public_int_i (tunnel code by Ethan Alexander Shulman, 2017) | no licence stated in the code (Shadertoy default: CC BY-NC-SA 3.0) |
| Pegasus Galaxy | https://www.shadertoy.com/view/lty3Rt | Frank Hugenroth (frankenburgh), 2015 | no licence stated in the code (Shadertoy default: CC BY-NC-SA 3.0) |
| Supernova Remnant | https://www.shadertoy.com/view/MdKXzc | Duke | CC BY-NC-SA 3.0 |

Licences: where the author wrote one in the shader's header it is listed above. Shadertoy shaders without a
licence line fall under Shadertoy's default licence (CC BY-NC-SA 3.0): credit the author, non-commercial use, share-alike.
This is a non-commercial school project, and every shader is credited in the table above and in the header of its `.wgsl` file.

## Shaders I edited
All shaders were ported from GLSL to WGSL (`src/shaders/`), and all of them have the same additions: a mouse-controlled
point of view, roll, zoom, colour shift, a flash pulse and a seed (for a new random variant). Per shader:

| Shader | Main changes |
| --- | --- |
| Kaleidoscope Rift | random star colours and sizes, new sky (random layout), warp (time speed), roll, zoom |
| Aqua | noise texture replaced by procedural 3D noise; camera orbits the planet with the mouse; more ocean; seed gives a new planet |
| Rubra | bounding-sphere early-out for the ray march; camera orbits the planet with the mouse; seed gives a new planet |
| Star Nest | the mouse only tilts the view a little (the original moved the camera through the fractal and felt far too fast); seed moves to another place in the nebula |
| The Vortex | 16 samples of anti-aliasing instead of 64 for performance; mouse shifts the tunnel centre |
| Pegasus Galaxy | intro/outro fade removed so it runs forever; the mouse swings the camera around the galaxy |
| Supernova Remnant | noise textures replaced by procedural noise; 1-2-3 zoom keys replaced by the zoom slider; the mouse turns the nebula |

## Run
```
npm install
npm run dev
npm run build
```
