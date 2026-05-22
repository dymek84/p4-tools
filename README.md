# p4-tools
### Advanced FX & Shader Toolkit for Phaser 4 (WebGL2 / WebGPU)

`p4-tools` is a modular collection of rendering utilities, shader pipelines, and FX integrations designed to extend **Phaser 4** with modern GPU‑driven visual effects.

Phaser 4 provides a fast low‑level renderer, but lacks a high‑level FX system.  
This toolkit fills that gap by integrating:

- **Three.js** (post‑processing, bloom, distortion, GPU particles)
- **regl** (clean WebGL2 shader abstraction)
- **PixiJS Filters** (plug‑and‑play shader effects)

The goal is to make Phaser 4 capable of dynamic, modern effects without rewriting boilerplate every time.

---

## Features

### ✔ Phaser 4 + PixiJS Filters
- Shockwave
- Bloom
- Glitch
- Outline
- ColorMatrix
- Noise
- Pixelate
- Zoom blur
- Motion blur

### ✔ Phaser 4 + regl
- Procedural noise
- Distortion fields
- Heat haze
- Lightning arcs
- Energy rings
- Custom render passes

### ✔ Phaser 4 + Three.js
- Post‑processing pipeline
- Bloom + blur stack
- Distortion pass
- Composite Three.js scenes into Phaser textures
- GPU particle effects

### ✔ WebGPU (Experimental)
- WGSL shader modules
- Compute‑style particle updates
- WebGPU render pass integration

---

## Why This Exists

Phaser 4 is powerful but minimal. It does not include:

- a post‑processing stack  
- a material system  
- a shader graph  
- particle‑shader integration  
- examples for advanced GLSL  
- WebGPU utilities  

`p4-tools` provides these missing layers so developers can build:

- shockwaves  
- distortion FX  
- bloom  
- lightning  
- procedural energy effects  
- heat haze  
- additive plasma  
- GPU particles  

…directly inside Phaser 4.

---

## Project Structure

