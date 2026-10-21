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

## Shadertoy shaders used
| Destination | Shader | Author |
| --- | --- | --- |
| Kaleidoscope Rift | https://www.shadertoy.com/view/ftt3R7 | DanielXMoore |
| Aqua | https://www.shadertoy.com/view/Ds3XRl (Procedural Blue Planet) | Julien Sulpis |
| Rubra | https://www.shadertoy.com/view/msdXzl (Procedural Red Planet) | Julien Sulpis |
| Star Nest | https://www.shadertoy.com/view/XlfGRj | Kali (Pablo Roman Andrioli) |
| The Vortex | https://www.shadertoy.com/view/XdBBDz | public_int_i (tunnel code by Ethan Alexander Shulman, 2017) |
| Pegasus Galaxy | https://www.shadertoy.com/view/lty3Rt | Frank Hugenroth (frankenburgh), 2015 |
| Supernova Remnant | https://www.shadertoy.com/view/MdKXzc | Duke |

Every shader is credited above and in the header of its `.wgsl` file. 

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
```
