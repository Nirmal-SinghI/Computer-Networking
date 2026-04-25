# Banach–Tarski Inspired Sphere Visualization

This project is an **educational approximation** of Banach–Tarski-style reassembly using finite, deterministic point partitions and rigid motions in 3D.

> Important limitation: the real Banach–Tarski theorem is non-constructive and cannot be directly implemented with finite numerical computation. This project visually imitates the idea for learning and presentation.

## Features

- Three.js-based 3D sphere visualization
- Deterministic partitioning into color-coded subsets
- Animation pipeline for piecewise rotation/drift/reassembly
- Two same-radius target spheres for paradox-inspired duplication effect
- Interactive controls for:
  - partitions/pieces
  - random seed
  - angle range
  - animation speed
  - point density
  - render mode (points / wireframe / solid)
  - subset visibility filtering
- Playback controls: play, pause, scrub timeline, reset
- Presentation mode: one-click scripted classroom demo sequence
- Preset system:
  - built-in presets
  - export preset to JSON
  - load preset from JSON
- Screenshot export for project reports/slides
- On-screen narration about what is rigorous math vs simulation approximation

## Quick Start

### Prerequisites
- Node.js 18+ (or newer)

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

### Build

```bash
npm run build
```

### Preview build

```bash
npm run preview
```

## Suggested Demo Presets

Included presets in the control panel:

1. **Classroom Intro** – balanced settings for explanation
2. **High Contrast** – stronger visual separation of subsets
3. **Dense Experimental** – heavier point density for richer effect

## Presentation Mode

Use the **Presentation** folder in the control panel:

- **Start presentation**: runs a guided sequence across presets/stages
- **Stop presentation**: exits scripted mode and returns manual control

## Recommended Presentation Flow

1. Show original sphere with points mode
2. Explain finite partitioning and deterministic seed
3. Run timeline through the three animation stages
4. Highlight two target spheres of equal displayed radius
5. Reiterate mathematical limitation and educational goal
