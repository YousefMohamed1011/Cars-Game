import * as THREE from 'three';

/**
 * TextureGenerator.ts
 * In-memory procedural PBR texture generator using THREE.DataTexture.
 * 100% compatible with React Native (expo-gl) and Web without DOM canvas dependencies.
 */

// Simple deterministic PRNG for procedural noise
function pseudoRandom(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * 1. Realistic Asphalt Texture
 * Granular asphalt aggregate noise, micro bitumen speckles, and subtle tire skid wear streaks.
 */
export function createAsphaltTexture(width = 512, height = 512): THREE.DataTexture {
  const size = width * height * 4;
  const data = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Base asphalt color (dark charcoal)
      const noise1 = pseudoRandom(x * 0.15, y * 0.15);
      const noise2 = pseudoRandom(x * 0.45, y * 0.45);
      const noise3 = pseudoRandom(x * 0.02, y * 0.02);

      let val = 28 + Math.floor(noise1 * 14 + noise2 * 8 + noise3 * 6);

      // Tire skid marks along Y axis
      const skidLane1 = Math.abs(x - width * 0.32) < 22;
      const skidLane2 = Math.abs(x - width * 0.68) < 22;
      if (skidLane1 || skidLane2) {
        val = Math.max(16, val - 7);
      }

      // Small stone flecks (lighter aggregates)
      if (noise1 > 0.94) {
        val = Math.min(85, val + 35);
      }

      data[idx] = val;         // R
      data[idx + 1] = val + 1; // G
      data[idx + 2] = val + 3; // B (slightly cool tint)
      data[idx + 3] = 255;     // Alpha
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 24);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Asphalt Roughness / Bump map for physical micro-relief
 */
export function createAsphaltBumpMap(width = 256, height = 256): THREE.DataTexture {
  const size = width * height * 4;
  const data = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const n = pseudoRandom(x * 0.3, y * 0.3);
      const val = Math.floor(n * 255);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 24);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 2. Egyptian Painted Concrete Curbstone Texture (بلدورات الرصيف)
 * Alternating black-and-white / yellow-and-black blocks with concrete weathering and dust.
 */
export function createCurbTexture(width = 256, height = 64, scheme: 'black_yellow' | 'black_white' = 'black_yellow'): THREE.DataTexture {
  const size = width * height * 4;
  const data = new Uint8Array(size);

  const blockWidth = width / 4; // 4 alternating blocks per cycle

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const blockIndex = Math.floor(x / blockWidth);
      const isStripe = blockIndex % 2 === 0;

      const noise = pseudoRandom(x * 0.2, y * 0.2) * 18 - 9;
      // Vertical gradient: dirt accumulation at the bottom curb edge
      const dustFactor = (y / height) * 0.25;

      let r = 0, g = 0, b = 0;

      if (isStripe) {
        if (scheme === 'black_yellow') {
          // Egyptian warning yellow
          r = Math.min(255, Math.max(0, 225 + noise));
          g = Math.min(255, Math.max(0, 175 + noise));
          b = Math.min(255, Math.max(0, 30 + noise));
        } else {
          // Concrete white
          const w = Math.min(255, Math.max(0, 210 + noise));
          r = w; g = w; b = w;
        }
      } else {
        // Concrete black
        const blk = Math.min(255, Math.max(0, 35 + noise));
        r = blk; g = blk; b = blk;
      }

      // Blend dirt at ground
      r = Math.floor(r * (1 - dustFactor) + 60 * dustFactor);
      g = Math.floor(g * (1 - dustFactor) + 55 * dustFactor);
      b = Math.floor(b * (1 - dustFactor) + 45 * dustFactor);

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(16, 1);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 3. Realistic Egyptian Building Facade Texture
 * Multi-story red-brick / weathered beige concrete with balconies, illuminated windows, AC units, and ground shops.
 */
export function createBuildingTexture(
  width = 512,
  height = 512,
  style: 'red_brick' | 'beige_concrete' = 'beige_concrete'
): THREE.DataTexture {
  const size = width * height * 4;
  const data = new Uint8Array(size);

  const numFloors = 8;
  const numWindows = 6;
  const floorHeight = height / numFloors;
  const windowColWidth = width / numWindows;

  for (let y = 0; y < height; y++) {
    const floorIndex = Math.floor(y / floorHeight);
    const inFloorY = (y % floorHeight) / floorHeight; // 0 to 1

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const windowIndex = Math.floor(x / windowColWidth);
      const inWindowX = (x % windowColWidth) / windowColWidth; // 0 to 1

      const n = pseudoRandom(x * 0.1, y * 0.1);

      // Base wall color
      let r = style === 'red_brick' ? 145 : 185;
      let g = style === 'red_brick' ? 75 : 165;
      let b = style === 'red_brick' ? 55 : 140;

      // Stucco / brick weathering noise
      r = Math.min(255, Math.max(0, r + Math.floor(n * 20 - 10)));
      g = Math.min(255, Math.max(0, g + Math.floor(n * 20 - 10)));
      b = Math.min(255, Math.max(0, b + Math.floor(n * 20 - 10)));

      // Ground Floor: Retail shops with illuminated sign boards
      if (floorIndex === 0) {
        if (inFloorY > 0.65) {
          // Shop signboard
          r = 210; g = 50; b = 40; // Vibrant red/amber store banner
        } else if (inFloorY > 0.1 && inWindowX > 0.15 && inWindowX < 0.85) {
          // Lit shop glass window
          r = 245; g = 220; b = 170;
        } else {
          // Steel roller shutter
          const shutterStripe = Math.floor(y * 0.8) % 2 === 0 ? 30 : -20;
          r = 90 + shutterStripe; g = 95 + shutterStripe; b = 100 + shutterStripe;
        }
      } else {
        // Residential floors (Balcony, Windows, AC units)
        const isWindowX = inWindowX > 0.25 && inWindowX < 0.75;
        const isWindowY = inFloorY > 0.35 && inFloorY < 0.85;

        // Balcony railing slab
        if (inFloorY > 0.08 && inFloorY < 0.28 && isWindowX) {
          r = 130; g = 120; b = 110; // Concrete balcony wall
        } else if (isWindowX && isWindowY) {
          // Window Frame & Glass
          const isFrame = inWindowX < 0.28 || inWindowX > 0.72 || inFloorY < 0.38 || inFloorY > 0.82;
          if (isFrame) {
            r = 60; g = 55; b = 50; // Dark aluminium window frame
          } else {
            // Window lighting: 60% chance warm golden light, 40% unlit
            const windowSeed = pseudoRandom(floorIndex * 7, windowIndex * 13);
            if (windowSeed > 0.42) {
              // Warm incandescent room light (Egyptian evening)
              r = 255;
              g = 210 - Math.floor(windowSeed * 30);
              b = 130;
            } else {
              // Dark room glass
              r = 28; g = 32; b = 42;
            }
          }
        }

        // AC Outdoor Unit mounted below window
        if (inFloorY > 0.26 && inFloorY < 0.34 && inWindowX > 0.55 && inWindowX < 0.78) {
          r = 220; g = 220; b = 215; // Off-white AC box
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 4. Procedural Environment Sky Reflection Map
 * Warm sunset/golden-hour panoramic sky with twilight violet, amber horizon, and street-glow.
 */
export function createEnvMap(width = 256, height = 128): THREE.DataTexture {
  const size = width * height * 4;
  const data = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    const v = y / height; // 0 = top (zenith), 1 = bottom (nadir)

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const u = x / width;

      let r = 0, g = 0, b = 0;

      if (v < 0.45) {
        // Upper Sky: Deep Twilight Violet to Warm Indigo
        const t = v / 0.45;
        r = Math.floor(40 * (1 - t) + 160 * t);
        g = Math.floor(30 * (1 - t) + 90 * t);
        b = Math.floor(80 * (1 - t) + 60 * t);
      } else if (v < 0.58) {
        // Horizon Sunset Band: Intense Amber / Golden Glow
        const t = (v - 0.45) / 0.13;
        // Sun azimuth hotspot at u = 0.35
        const sunDist = Math.abs(u - 0.35);
        const sunIntensity = Math.max(0, 1 - sunDist * 4);

        r = Math.floor(220 + sunIntensity * 35);
        g = Math.floor(130 * (1 - t) + 180 * t * sunIntensity);
        b = Math.floor(50 * (1 - t) + 80 * t * sunIntensity);
      } else {
        // Ground / Road Horizon Reflection (Dark asphalt with ambient street glow)
        const t = (v - 0.58) / 0.42;
        r = Math.floor(45 * (1 - t) + 15 * t);
        g = Math.floor(35 * (1 - t) + 16 * t);
        b = Math.floor(40 * (1 - t) + 20 * t);
      }

      data[idx] = Math.min(255, Math.max(0, r));
      data[idx + 1] = Math.min(255, Math.max(0, g));
      data[idx + 2] = Math.min(255, Math.max(0, b));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}
