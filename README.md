# 251016_TwistingTower

251016_TwistingTower is an interactive 3D tool for sketching twisting high-rise silhouettes. It combines Three.js with a custom generator so you can stack, taper, and rotate individual floors, then iterate in real time with a design-focused control panel.

## Features
- Parametric tower builder that animates changes to level count, total height, floor thickness, and twist as you tweak values.
- Curve-driven easing for scale, offset, rotation, and color gradients with Bezier editors to fine-tune behavior across the tower’s height.
- Lighting and atmosphere presets (Studio, Sunset, Midnight, etc.), grid and shadow toggles, and background color controls for presentation-ready renders.
- Export shortcuts for screenshots, OBJ meshes, and saved parameter snapshots so you can share or revisit designs.
- Built with Vite and Three.js, providing fast reloads and high-performance WebGL rendering.

## Getting Started
1. Install dependencies: `npm install`
2. Start the development server: `npm run dev` (opens on http://localhost:5173 by default)
3. Build for production: `npm run build`
4. Preview the production build locally: `npm run preview`

## Controls
- **Camera:** Left drag to orbit, right drag to pan, and scroll to zoom using OrbitControls.
- **Floors:** Adjust the number of levels, total height, rotation, and floor thickness while watching the tower update instantly.
- **Size:** Set base and top radii, radial segments, and optional scale curves to sculpt the profile.
- **Offset:** Slide the stack horizontally with base/top offsets, easing presets, or custom offset curves.
- **Rotation:** Blend base and top rotation angles, pick twist easing, or author a bespoke rotation curve.
- **Color:** Choose base/top colors, switch gradient easing, and enable a color curve for advanced transitions.
- **Scene:** Toggle the ground grid, turn shadows on or off, swap lighting schemes, and recolor the background.
- **Save:** Export a PNG image, download the generated OBJ mesh, or store and reload parameter snapshots from the GUI.
