import * as THREE from 'three';
import { CarSpecs, CarCustomization } from '../../types';
import { Car3DObject } from './ProceduralCars';

/**
 * RealisticCarBuilder.ts
 * High-Detail Contoured Geometry Enhancer for Expo GL + Three.js
 * Builds bespoke contoured ExtrudeGeometry bodies, wheel arches, 3D multi-spoke rims,
 * drilled brake discs with red calipers, tinted glass, cockpit interior, and lighting.
 */

// Gauge object with moving needle
interface AnalogGauge {
  group: THREE.Group;
  needle: THREE.Group;
  setValue: (ratio: number) => void;
}

function createDashboardGauge(
  radius: number,
  label: string,
  minVal: number,
  maxVal: number
): AnalogGauge {
  const group = new THREE.Group();

  // Bezel
  const bezelGeo = new THREE.TorusGeometry(radius, radius * 0.1, 8, 24);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.9,
    roughness: 0.15,
  });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  group.add(bezel);

  // Dial face
  const faceGeo = new THREE.CircleGeometry(radius * 0.95, 24);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x111318 });
  const face = new THREE.Mesh(faceGeo, faceMat);
  group.add(face);

  // Needle
  const needleGroup = new THREE.Group();
  const needleGeo = new THREE.BoxGeometry(radius * 0.08, radius * 0.85, 0.01);
  needleGeo.translate(0, radius * 0.4, 0.02);
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Sport red needle
  const needleMesh = new THREE.Mesh(needleGeo, needleMat);
  needleGroup.add(needleMesh);
  group.add(needleGroup);

  const minAngle = Math.PI * 0.75;
  const maxAngle = -Math.PI * 0.75;

  return {
    group,
    needle: needleGroup,
    setValue: (ratio: number) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      needleGroup.rotation.z = minAngle + (maxAngle - minAngle) * clamped;
    },
  };
}

/**
 * Creates a detailed 3D wheel with tire tread, rim spokes, brake disc, and red caliper
 */
function createDetailedWheel(
  radius: number,
  width: number,
  rimStyle: 'mesh' | '5spoke' | 'classic',
  rimColorHex: string,
  isFront: boolean
): THREE.Group {
  const wheelGroup = new THREE.Group();
  wheelGroup.name = isFront ? 'FrontWheel_Assembly' : 'RearWheel_Assembly';

  // 1. Tire Rubber
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.9,
    metalness: 0.05,
  });
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  // 2. Wheel Rim Outer Lip
  const rimRadius = radius * 0.68;
  const rimDepth = width * 1.02;
  const rimLipGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, rimDepth, 24, 1, true);
  rimLipGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rimColorHex),
    metalness: 0.85,
    roughness: 0.22,
  });
  const rimLipMesh = new THREE.Mesh(rimLipGeo, rimMat);
  wheelGroup.add(rimLipMesh);

  // 3. Center Hub & Spokes
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.22, rimRadius * 0.22, width * 1.04, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, rimMat);
  wheelGroup.add(hubMesh);

  const spokeCount = rimStyle === 'mesh' ? 14 : rimStyle === '5spoke' ? 5 : 8;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const spokeGeo = new THREE.BoxGeometry(width * 0.98, rimRadius * 0.72, rimStyle === 'mesh' ? 0.025 : 0.045);
    const spokeMesh = new THREE.Mesh(spokeGeo, rimMat);
    spokeMesh.position.set(0, (rimRadius * 0.42) * Math.cos(angle), (rimRadius * 0.42) * Math.sin(angle));
    spokeMesh.rotation.x = angle;
    wheelGroup.add(spokeMesh);
  }

  // 4. Drilled Brake Disc (Metallic)
  const discRadius = rimRadius * 0.82;
  const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, width * 0.25, 20);
  discGeo.rotateZ(Math.PI / 2);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x88929b,
    metalness: 0.92,
    roughness: 0.15,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.position.x = isFront ? 0.02 : -0.02;
  wheelGroup.add(discMesh);

  // 5. Red Sport Brake Caliper
  const caliperGeo = new THREE.BoxGeometry(width * 0.35, discRadius * 0.45, discRadius * 0.32);
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xcc1111,
    metalness: 0.6,
    roughness: 0.2,
  });
  const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
  caliperMesh.position.set(isFront ? 0.03 : -0.03, discRadius * 0.6, 0);
  wheelGroup.add(caliperMesh);

  return wheelGroup;
}

/**
 * Builds a highly-contoured 3D vehicle using ExtrudeGeometry and specialized styling
 */
export function buildRealisticCar(specs: CarSpecs, custom: CarCustomization): Car3DObject {
  const root = new THREE.Group();
  root.name = `RealisticCar_${specs.id}`;

  const isFiat = specs.id === 'fiat_132';
  const isBmw = specs.id === 'bmw_e30';
  const isOptra = specs.id === 'optra_2012';

  // -----------------------------------------------------------------
  // 1. VEHICLE MATERIALS (MeshPhysicalMaterial with clearcoat)
  // -----------------------------------------------------------------
  const bodyPaintColor = new THREE.Color(custom.bodyColor || specs.defaultColor);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: bodyPaintColor,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.rimColor || specs.defaultRimColor),
    metalness: 0.88,
    roughness: 0.20,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111622,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.45 + (custom.windowTint || 0) * 0.4,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    metalness: 0.98,
    roughness: 0.06,
  });

  const interiorDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.85,
    metalness: 0.1,
  });

  // -----------------------------------------------------------------
  // 2. CONTOURED BODY (ExtrudeGeometry Silhouette)
  // -----------------------------------------------------------------
  const bodyShape = new THREE.Shape();
  const halfL = isOptra ? 2.25 : isBmw ? 2.18 : 2.15;
  const bodyH = isFiat ? 0.88 : isBmw ? 0.78 : 0.82;
  const cabinH = isFiat ? 0.68 : isBmw ? 0.58 : 0.62;

  // Longitudinal profile (Z and Y coordinates)
  // Start at front bumper lower lip
  bodyShape.moveTo(-halfL, 0.22);
  bodyShape.lineTo(-halfL + 0.1, 0.48); // front nose
  bodyShape.lineTo(-halfL + 0.4, bodyH * 0.95); // front grille/headlight top
  bodyShape.lineTo(-halfL + 1.25, bodyH); // hood slope
  // Windshield rake
  bodyShape.lineTo(-halfL + 1.7, bodyH + cabinH); // A-pillar to roof
  // Roof line
  bodyShape.lineTo(halfL - 1.1, bodyH + cabinH * 0.98); // roof to rear glass
  // Rear window rake
  bodyShape.lineTo(halfL - 0.55, bodyH * 0.95); // C-pillar to trunk deck
  // Trunk deck
  bodyShape.lineTo(halfL - 0.08, bodyH * 0.92);
  // Rear bumper drop
  bodyShape.lineTo(halfL, 0.45);
  bodyShape.lineTo(halfL - 0.05, 0.22);
  // Bottom sill
  bodyShape.lineTo(-halfL, 0.22);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 2,
    depth: isOptra ? 1.78 : isBmw ? 1.72 : 1.75,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
  };

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
  // Center geometry
  bodyGeo.center();
  bodyGeo.rotateY(Math.PI / 2); // Align with car driving axis

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.position.y = 0.58 + (custom.suspensionHeight || 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // -----------------------------------------------------------------
  // 3. CABIN GLASS & A/B/C PILLARS
  // -----------------------------------------------------------------
  const glassWidth = extrudeSettings.depth! * 0.92;
  const cabinGlassGeo = new THREE.BoxGeometry(glassWidth, cabinH * 0.92, halfL * 0.95);
  const cabinGlass = new THREE.Mesh(cabinGlassGeo, glassMaterial);
  cabinGlass.position.set(0, 0.58 + bodyH * 0.5 + cabinH * 0.46, -0.05);
  root.add(cabinGlass);

  // -----------------------------------------------------------------
  // 4. BESPOKE MODEL VISUAL DETAILING
  // -----------------------------------------------------------------
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const hazardMeshes: THREE.Mesh[] = [];
  const spotlights: THREE.SpotLight[] = [];

  const carWidth = extrudeSettings.depth!;
  const frontZ = halfL + 0.02;
  const rearZ = -halfL - 0.02;

  if (isFiat) {
    // ---------------- Fiat 132 (2000cc) ----------------
    // Classic Chrome Bumpers
    const frontBumperGeo = new THREE.BoxGeometry(carWidth * 1.04, 0.16, 0.18);
    const frontBumper = new THREE.Mesh(frontBumperGeo, chromeMaterial);
    frontBumper.position.set(0, 0.42, frontZ + 0.08);
    root.add(frontBumper);

    const rearBumper = frontBumper.clone();
    rearBumper.position.set(0, 0.42, rearZ - 0.08);
    root.add(rearBumper);

    // Quad Round Headlights with Chrome Rings
    [-0.55, -0.28, 0.28, 0.55].forEach((xOffset) => {
      const ringGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 20);
      const ring = new THREE.Mesh(ringGeo, chromeMaterial);
      ring.position.set(xOffset, 0.72, frontZ + 0.02);
      root.add(ring);

      const lampGeo = new THREE.CircleGeometry(0.1, 16);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfffae6,
        emissive: 0xffeedd,
        emissiveIntensity: 0.9,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(xOffset, 0.72, frontZ + 0.025);
      root.add(lamp);
      headlightMeshes.push(lamp);
    });

    // Front License Plate "Fiat 132"
    const plateGeo = new THREE.BoxGeometry(0.48, 0.14, 0.02);
    const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.36, frontZ + 0.18);
    root.add(plate);

  } else if (isOptra) {
    // ---------------- Chevrolet Optra 2012 ----------------
    // Split front grille with gold bowtie emblem
    const grilleGeo = new THREE.BoxGeometry(0.72, 0.24, 0.05);
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, 0.68, frontZ);
    root.add(grille);

    // Gold Bowtie Emblem
    const bowtieGeo = new THREE.BoxGeometry(0.16, 0.06, 0.03);
    const bowtieMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
    const bowtie = new THREE.Mesh(bowtieGeo, bowtieMat);
    bowtie.position.set(0, 0.68, frontZ + 0.035);
    root.add(bowtie);

    // Swept Modern Headlights
    [-0.62, 0.62].forEach((xOffset) => {
      const lampGeo = new THREE.BoxGeometry(0.36, 0.18, 0.08);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(xOffset, 0.72, frontZ);
      lamp.rotation.y = xOffset < 0 ? -0.22 : 0.22;
      root.add(lamp);
      headlightMeshes.push(lamp);
    });

  } else if (isBmw) {
    // ---------------- BMW E30 (325i) ----------------
    // Twin Kidney Grille
    [-0.11, 0.11].forEach((xOffset) => {
      const kidneyGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 16);
      const kidneyMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8, roughness: 0.3 });
      const kidney = new THREE.Mesh(kidneyGeo, kidneyMat);
      kidney.scale.set(0.65, 1.25, 1);
      kidney.position.set(xOffset, 0.68, frontZ + 0.02);
      root.add(kidney);
    });

    // Quad Circular Angel-Eye Headlights
    [-0.62, -0.38, 0.38, 0.62].forEach((xOffset) => {
      const angelRingGeo = new THREE.TorusGeometry(0.10, 0.015, 8, 20);
      const angelRingMat = new THREE.MeshBasicMaterial({ color: 0xcceeff });
      const angelRing = new THREE.Mesh(angelRingGeo, angelRingMat);
      angelRing.position.set(xOffset, 0.70, frontZ + 0.02);
      root.add(angelRing);

      const lampGeo = new THREE.CircleGeometry(0.09, 16);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xddeeff,
        emissiveIntensity: 1.1,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(xOffset, 0.70, frontZ + 0.025);
      root.add(lamp);
      headlightMeshes.push(lamp);
    });

    // Trunk Lip Spoiler
    const spoilerGeo = new THREE.BoxGeometry(carWidth * 0.94, 0.08, 0.22);
    const spoiler = new THREE.Mesh(spoilerGeo, bodyMaterial);
    spoiler.position.set(0, bodyH + 0.38, rearZ + 0.12);
    root.add(spoiler);
  }

  // Common Taillights (Left & Right)
  [-0.62, 0.62].forEach((xOffset) => {
    const tailGeo = new THREE.BoxGeometry(0.38, 0.16, 0.04);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x990000,
      emissive: 0x660000,
      emissiveIntensity: 0.6,
    });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(xOffset, 0.68, rearZ);
    root.add(tail);
    taillightMeshes.push(tail);

    // Hazard / Amber Turn Signals
    const hazGeo = new THREE.BoxGeometry(0.12, 0.16, 0.042);
    const hazMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x000000,
    });
    const haz = new THREE.Mesh(hazGeo, hazMat);
    haz.position.set(xOffset > 0 ? xOffset + 0.14 : xOffset - 0.14, 0.68, rearZ);
    root.add(haz);
    hazardMeshes.push(haz);
  });

  // Projector Spotlights for Night Driving
  [-0.5, 0.5].forEach((xOffset) => {
    const spot = new THREE.SpotLight(0xfffae6, 2.5, 45, Math.PI * 0.22, 0.35, 1.2);
    spot.position.set(xOffset, 0.72, frontZ + 0.2);
    spot.target.position.set(xOffset, 0, frontZ + 25);
    root.add(spot);
    root.add(spot.target);
    spotlights.push(spot);
  });

  // Dual Stainless Exhaust Pipes
  [-0.45, -0.32].forEach((xOffset) => {
    const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exhaust.position.set(xOffset, 0.26, rearZ - 0.06);
    root.add(exhaust);
  });

  // -----------------------------------------------------------------
  // 5. COCKPIT INTERIOR: SEATS, STEERING WHEEL & ILLUMINATED GAUGES
  // -----------------------------------------------------------------
  // Driver Seat & Passenger Seat
  [-0.42, 0.42].forEach((xOffset) => {
    const seatBaseGeo = new THREE.BoxGeometry(0.52, 0.16, 0.55);
    const seatBase = new THREE.Mesh(seatBaseGeo, interiorDarkMaterial);
    seatBase.position.set(xOffset, 0.52, -0.05);
    root.add(seatBase);

    const seatBackGeo = new THREE.BoxGeometry(0.50, 0.62, 0.14);
    const seatBack = new THREE.Mesh(seatBackGeo, interiorDarkMaterial);
    seatBack.position.set(xOffset, 0.82, -0.32);
    seatBack.rotation.x = -0.15;
    root.add(seatBack);
  });

  // Dashboard Console
  const dashGeo = new THREE.BoxGeometry(carWidth * 0.88, 0.32, 0.55);
  const dash = new THREE.Mesh(dashGeo, interiorDarkMaterial);
  dash.position.set(0, 0.82, 0.48);
  root.add(dash);

  // Rotating Steering Wheel (Driver's seat at x = -0.42)
  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.position.set(-0.42, 0.88, 0.32);
  steeringWheelGroup.rotation.x = -0.35;

  const steerRingGeo = new THREE.TorusGeometry(0.18, 0.022, 10, 24);
  const steerMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.7 });
  const steerRing = new THREE.Mesh(steerRingGeo, steerMat);
  steeringWheelGroup.add(steerRing);

  // Spokes
  const spokeGeo = new THREE.BoxGeometry(0.34, 0.025, 0.02);
  const spoke = new THREE.Mesh(spokeGeo, chromeMaterial);
  steeringWheelGroup.add(spoke);

  root.add(steeringWheelGroup);

  // Moving Dashboard Gauges
  const speedoGauge = createDashboardGauge(0.065, 'KMH', 0, specs.topSpeedKmh);
  speedoGauge.group.position.set(-0.35, 0.95, 0.52);
  speedoGauge.group.rotation.x = -0.25;
  root.add(speedoGauge.group);

  const tachoGauge = createDashboardGauge(0.065, 'RPM', 0, 8000);
  tachoGauge.group.position.set(-0.49, 0.95, 0.52);
  tachoGauge.group.rotation.x = -0.25;
  root.add(tachoGauge.group);

  // Side Mirrors
  [-carWidth * 0.52, carWidth * 0.52].forEach((xOffset) => {
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.10, 0.08);
    const mirror = new THREE.Mesh(mirrorGeo, bodyMaterial);
    mirror.position.set(xOffset, 0.92, 0.62);
    root.add(mirror);

    const mirrorGlassGeo = new THREE.BoxGeometry(0.16, 0.08, 0.01);
    const mirrorGlass = new THREE.Mesh(mirrorGlassGeo, chromeMaterial);
    mirrorGlass.position.set(xOffset, 0.92, 0.58);
    root.add(mirrorGlass);
  });

  // -----------------------------------------------------------------
  // 6. 3D WHEELS & SUSPENSION
  // -----------------------------------------------------------------
  const wheelRadius = isBmw ? 0.33 : isFiat ? 0.34 : 0.33;
  const wheelWidth = 0.24;
  const wheelBaseX = carWidth * 0.48;
  const wheelBaseZ = halfL * 0.62;
  const rimStyle = isBmw ? 'mesh' : isOptra ? '5spoke' : 'classic';

  const frontLeftWheel = createDetailedWheel(wheelRadius, wheelWidth, rimStyle, custom.rimColor || specs.defaultRimColor, true);
  frontLeftWheel.position.set(-wheelBaseX, wheelRadius + (custom.suspensionHeight || 0), wheelBaseZ);
  root.add(frontLeftWheel);

  const frontRightWheel = createDetailedWheel(wheelRadius, wheelWidth, rimStyle, custom.rimColor || specs.defaultRimColor, true);
  frontRightWheel.position.set(wheelBaseX, wheelRadius + (custom.suspensionHeight || 0), wheelBaseZ);
  root.add(frontRightWheel);

  const rearLeftWheel = createDetailedWheel(wheelRadius, wheelWidth, rimStyle, custom.rimColor || specs.defaultRimColor, false);
  rearLeftWheel.position.set(-wheelBaseX, wheelRadius + (custom.suspensionHeight || 0), -wheelBaseZ);
  root.add(rearLeftWheel);

  const rearRightWheel = createDetailedWheel(wheelRadius, wheelWidth, rimStyle, custom.rimColor || specs.defaultRimColor, false);
  rearRightWheel.position.set(wheelBaseX, wheelRadius + (custom.suspensionHeight || 0), -wheelBaseZ);
  root.add(rearRightWheel);

  const wheels = [frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel];

  // Neon Underglow Light
  let underglowLight: THREE.PointLight | null = null;
  if (custom.neonUnderglow) {
    underglowLight = new THREE.PointLight(new THREE.Color(custom.neonUnderglow), 3.5, 6.0);
    underglowLight.position.set(0, 0.15, 0);
    root.add(underglowLight);
  }

  // -----------------------------------------------------------------
  // 7. RETURN COMPLETED CAR3D OBJECT
  // -----------------------------------------------------------------
  return {
    group: root,
    wheels,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    headlights: spotlights,
    headlightMeshes,
    taillightMeshes,
    hazardMeshes,
    underglowLight,
    bodyMesh,
    bodyMaterial,
    rimMaterial,
    interiorSteeringWheel: steeringWheelGroup,

    updateCustomization: (newCustom: CarCustomization) => {
      if (newCustom.bodyColor) {
        bodyMaterial.color.set(newCustom.bodyColor);
      }
      if (newCustom.rimColor) {
        rimMaterial.color.set(newCustom.rimColor);
      }
      if (newCustom.windowTint !== undefined) {
        glassMaterial.opacity = 0.45 + newCustom.windowTint * 0.4;
      }
      if (newCustom.neonUnderglow !== undefined) {
        if (newCustom.neonUnderglow) {
          if (!underglowLight) {
            underglowLight = new THREE.PointLight(new THREE.Color(newCustom.neonUnderglow), 3.5, 6.0);
            underglowLight.position.set(0, 0.15, 0);
            root.add(underglowLight);
          } else {
            underglowLight.color.set(newCustom.neonUnderglow);
            underglowLight.visible = true;
          }
        } else if (underglowLight) {
          underglowLight.visible = false;
        }
      }
    },

    setBraking: (braking: boolean) => {
      taillightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.set(braking ? 0xff0000 : 0x660000);
        mat.emissiveIntensity = braking ? 1.6 : 0.6;
      });
    },

    setHeadlights: (on: boolean) => {
      spotlights.forEach((s) => (s.visible = on));
      headlightMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 1.0 : 0.05;
      });
    },

    setHazards: (on: boolean) => {
      hazardMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive.set(on ? 0xf59e0b : 0x000000);
        mat.emissiveIntensity = on ? 1.5 : 0;
      });
    },

    setSteeringAngle: (rad: number) => {
      frontLeftWheel.rotation.y = rad;
      frontRightWheel.rotation.y = rad;
      if (steeringWheelGroup) {
        steeringWheelGroup.rotation.z = -rad * 3.5;
      }
    },

    spinWheels: (speedDelta: number) => {
      wheels.forEach((w) => {
        w.rotation.x += speedDelta;
      });
    },

    updateCockpitTelemetry: (speedKmh: number, rpm: number, gear: number, steeringRatio: number) => {
      speedoGauge.setValue(speedKmh / specs.topSpeedKmh);
      tachoGauge.setValue(rpm / 7500);
    },
  };
}
