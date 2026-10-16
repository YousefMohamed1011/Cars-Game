import * as THREE from 'three';
import { CarSpecs, CarCustomization } from '../../types';

export interface Car3DObject {
  group: THREE.Group;
  wheels: THREE.Group[];
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  headlights: THREE.SpotLight[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  hazardMeshes: THREE.Mesh[];
  underglowLight: THREE.PointLight | null;
  bodyMesh: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  interiorSteeringWheel?: THREE.Group;
  gearStick?: THREE.Group;
  rearViewMirror?: THREE.Group;
  updateCustomization: (custom: CarCustomization) => void;
  setBraking: (braking: boolean) => void;
  setHeadlights: (on: boolean) => void;
  setHazards: (on: boolean) => void;
  setSteeringAngle: (rad: number) => void;
  spinWheels: (speedDelta: number) => void;
  updateCockpitTelemetry: (speedKmh: number, rpm: number, gear: number, steeringRatio: number) => void;
}

// Helper to create an analog gauge with moving needle
interface GaugeObject {
  group: THREE.Group;
  needleGroup: THREE.Group;
  setNormalizedValue: (ratio: number) => void;
}

function createAnalogGauge(
  radius: number,
  bezelColor: number,
  faceColor: number,
  needleColor: number,
  backlightColor: number | null = null,
  minAngle: number = -Math.PI * 0.72,
  maxAngle: number = Math.PI * 0.72
): GaugeObject {
  const group = new THREE.Group();

  // Bezel Ring
  const bezelGeo = new THREE.TorusGeometry(radius, radius * 0.12, 12, 24);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: bezelColor,
    metalness: 0.88,
    roughness: 0.2,
  });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  group.add(bezel);

  // Dial Face
  const faceGeo = new THREE.CircleGeometry(radius * 0.94, 24);
  const faceMat = new THREE.MeshStandardMaterial({
    color: faceColor,
    roughness: 0.85,
    metalness: 0.1,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.z = -0.004;
  group.add(face);

  // Optional Backlight Halo Ring (for Optra or BMW)
  if (backlightColor !== null) {
    const haloGeo = new THREE.RingGeometry(radius * 0.68, radius * 0.86, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: backlightColor,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = -0.002;
    group.add(halo);
  }

  // Dial Ticks
  const numTicks = 9;
  for (let i = 0; i < numTicks; i++) {
    const t = i / (numTicks - 1);
    const angle = minAngle + t * (maxAngle - minAngle);
    const isMajor = i % 2 === 0;
    const tickGeo = new THREE.PlaneGeometry(
      radius * (isMajor ? 0.05 : 0.03),
      radius * (isMajor ? 0.22 : 0.14)
    );
    const tickMat = new THREE.MeshBasicMaterial({
      color: backlightColor !== null ? backlightColor : 0xf8fafc,
    });
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.x = Math.sin(angle) * (radius * 0.72);
    tick.position.y = Math.cos(angle) * (radius * 0.72);
    tick.rotation.z = -angle;
    group.add(tick);
  }

  // Needle Pivot Group
  const needleGroup = new THREE.Group();
  needleGroup.position.z = 0.006;

  // Tapered Needle
  const needleGeo = new THREE.PlaneGeometry(radius * 0.065, radius * 0.76);
  needleGeo.translate(0, radius * 0.36, 0); // pivot from base
  const needleMat = new THREE.MeshBasicMaterial({ color: needleColor });
  const needle = new THREE.Mesh(needleGeo, needleMat);
  needleGroup.add(needle);

  // Center Cap
  const capGeo = new THREE.CircleGeometry(radius * 0.18, 16);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.8,
    roughness: 0.3,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.z = 0.008;
  needleGroup.add(cap);

  needleGroup.rotation.z = -minAngle;
  group.add(needleGroup);

  return {
    group,
    needleGroup,
    setNormalizedValue: (ratio: number) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      needleGroup.rotation.z = -(minAngle + clamped * (maxAngle - minAngle));
    },
  };
}

// Helper to create a wheel with rim, tire, disc brake, and caliper
function createWheel(
  radius: number = 0.36,
  width: number = 0.24,
  rimColor: string = '#E5E7EB',
  isFront: boolean = false
): { wheelGroup: THREE.Group; rimMat: THREE.MeshStandardMaterial } {
  const wheelGroup = new THREE.Group();

  // Rubber Tire
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1f2421,
    roughness: 0.85,
    metalness: 0.1,
  });
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.rotation.z = Math.PI / 2;
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  // Tire sidewall rim lip
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rimColor),
    metalness: 0.88,
    roughness: 0.22,
  });

  const rimGeo = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 1.02, 20);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.z = Math.PI / 2;
  wheelGroup.add(rimMesh);

  // Rim Spokes (5-spoke star or cross mesh)
  const spokeGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const angle = (i * (Math.PI * 2)) / 5;
    const spokeGeo = new THREE.BoxGeometry(0.04, radius * 0.65, 0.03);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.position.x = (width / 2) * 1.01;
    spoke.position.y = Math.cos(angle) * (radius * 0.32);
    spoke.position.z = Math.sin(angle) * (radius * 0.32);
    spoke.rotation.x = angle;
    spokeGroup.add(spoke);
  }
  wheelGroup.add(spokeGroup);

  // Steel Brake Disc inside wheel
  const discGeo = new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, 0.02, 16);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    metalness: 0.95,
    roughness: 0.35,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.rotation.z = Math.PI / 2;
  discMesh.position.x = -0.02;
  wheelGroup.add(discMesh);

  // Sport Brake Caliper
  const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
  const caliperMat = new THREE.MeshStandardMaterial({
    color: isFront ? 0xdc2626 : 0xf59e0b,
    roughness: 0.3,
    metalness: 0.5,
  });
  const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
  caliperMesh.position.set(-0.02, radius * 0.42, 0);
  wheelGroup.add(caliperMesh);

  return { wheelGroup, rimMat };
}

// Helper to create a realistic seat
function createSeat(leatherColor: number = 0x262626, hasSportBolsters: boolean = false): THREE.Group {
  const seatGroup = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({
    color: leatherColor,
    roughness: 0.65,
    metalness: 0.15,
  });

  // Seat Cushion Base
  const baseGeo = new THREE.BoxGeometry(0.48, 0.14, 0.48);
  const baseMesh = new THREE.Mesh(baseGeo, seatMat);
  baseMesh.position.y = 0.55;
  seatGroup.add(baseMesh);

  // Backrest
  const backGeo = new THREE.BoxGeometry(0.46, 0.56, 0.12);
  const backMesh = new THREE.Mesh(backGeo, seatMat);
  backMesh.position.set(0, 0.88, -0.22);
  backMesh.rotation.x = 0.18; // slightly reclined
  seatGroup.add(backMesh);

  // Headrest
  const headGeo = new THREE.BoxGeometry(0.24, 0.16, 0.1);
  const headMesh = new THREE.Mesh(headGeo, seatMat);
  headMesh.position.set(0, 1.22, -0.28);
  seatGroup.add(headMesh);

  // Sport Bolsters
  if (hasSportBolsters) {
    [-0.24, 0.24].forEach((x) => {
      const bolsterGeo = new THREE.BoxGeometry(0.08, 0.52, 0.18);
      const bolster = new THREE.Mesh(bolsterGeo, seatMat);
      bolster.position.set(x, 0.88, -0.16);
      bolster.rotation.x = 0.18;
      seatGroup.add(bolster);
    });
  }

  return seatGroup;
}

// Helper to create a windshield rear-view mirror
function createWindshieldMirror(): THREE.Group {
  const mirrorGroup = new THREE.Group();

  // Stalk mount
  const stalkGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8);
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
  const stalk = new THREE.Mesh(stalkGeo, stalkMat);
  stalk.rotation.x = Math.PI / 4;
  mirrorGroup.add(stalk);

  // Mirror Casing
  const caseGeo = new THREE.BoxGeometry(0.22, 0.07, 0.03);
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
  const casing = new THREE.Mesh(caseGeo, caseMat);
  casing.position.set(0, -0.03, 0.04);
  mirrorGroup.add(casing);

  // Mirror Reflective Glass Plate (facing driver)
  const glassGeo = new THREE.PlaneGeometry(0.20, 0.055);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.98,
    roughness: 0.05,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, -0.03, 0.024);
  glass.rotation.y = Math.PI; // faces back towards cabin
  mirrorGroup.add(glass);

  return mirrorGroup;
}

// 1. FIAT 132 (2000cc) - Classic Italian Sedan Builder
export function buildFiat132(specs: CarSpecs, custom: CarCustomization): Car3DObject {
  const root = new THREE.Group();
  root.name = 'Fiat132_Root';

  // Body Material: Classic Clearcoat Forest Metallic Green
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.bodyColor || specs.defaultColor),
    metalness: 0.75,
    roughness: 0.3,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    metalness: 0.98,
    roughness: 0.08,
  });

  const blackPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.7,
    metalness: 0.2,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.65 - (custom.windowTint || 0) * 0.35,
    roughness: 0.1,
    metalness: 0.1,
  });

  // Main Lower Sedan Chassis
  const lowerBodyGeo = new THREE.BoxGeometry(1.78, 0.52, 4.38);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
  lowerBody.position.y = 0.52;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  root.add(lowerBody);

  // Cabin Roof Panel (Open hollow interior cabin)
  const roofGeo = new THREE.BoxGeometry(1.64, 0.04, 2.25);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 1.30, -0.15);
  roof.castShadow = true;
  root.add(roof);

  // A, B, and C Pillars
  [-0.8, 0.8].forEach((x) => {
    // A-Pillars (Front windshield frame)
    const aPillarGeo = new THREE.BoxGeometry(0.06, 0.48, 0.06);
    const aPillar = new THREE.Mesh(aPillarGeo, bodyMat);
    aPillar.position.set(x, 1.05, 0.62);
    aPillar.rotation.x = -Math.PI / 5.2;
    root.add(aPillar);

    // B-Pillars (Middle)
    const bPillarGeo = new THREE.BoxGeometry(0.06, 0.52, 0.08);
    const bPillar = new THREE.Mesh(bPillarGeo, bodyMat);
    bPillar.position.set(x, 1.05, -0.15);
    root.add(bPillar);

    // C-Pillars (Rear)
    const cPillarGeo = new THREE.BoxGeometry(0.06, 0.50, 0.14);
    const cPillar = new THREE.Mesh(cPillarGeo, bodyMat);
    cPillar.position.set(x, 1.05, -1.05);
    cPillar.rotation.x = Math.PI / 4.8;
    root.add(cPillar);
  });

  // Windshields
  const frontWindshieldGeo = new THREE.PlaneGeometry(1.56, 0.62);
  const frontWindshield = new THREE.Mesh(frontWindshieldGeo, glassMat);
  frontWindshield.position.set(0, 1.02, 1.02);
  frontWindshield.rotation.x = -Math.PI / 5.2;
  root.add(frontWindshield);

  const rearWindshieldGeo = new THREE.PlaneGeometry(1.56, 0.62);
  const rearWindshield = new THREE.Mesh(rearWindshieldGeo, glassMat);
  rearWindshield.position.set(0, 1.02, -1.32);
  rearWindshield.rotation.x = Math.PI / 4.8;
  rearWindshield.rotation.y = Math.PI;
  root.add(rearWindshield);

  // Side Windows
  [-0.81, 0.81].forEach((x) => {
    const sideWinGeo = new THREE.PlaneGeometry(1.9, 0.44);
    const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
    sideWin.position.set(x, 1.04, -0.15);
    sideWin.rotation.y = Math.PI / 2;
    root.add(sideWin);
  });

  // Vintage Chrome Bumpers
  const bumperGeo = new THREE.BoxGeometry(1.84, 0.14, 0.16);
  const frontBumper = new THREE.Mesh(bumperGeo, chromeMat);
  frontBumper.position.set(0, 0.42, 2.22);
  root.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeo, chromeMat);
  rearBumper.position.set(0, 0.42, -2.22);
  root.add(rearBumper);

  // Front Grille
  const grilleGeo = new THREE.BoxGeometry(1.62, 0.28, 0.05);
  const grille = new THREE.Mesh(grilleGeo, blackPlasticMat);
  grille.position.set(0, 0.62, 2.18);
  root.add(grille);

  // Quad Round Headlights
  const headlightMeshes: THREE.Mesh[] = [];
  const headlights: THREE.SpotLight[] = [];
  const headlightOffsets = [-0.62, -0.42, 0.42, 0.62];

  headlightOffsets.forEach((xOffset, idx) => {
    const lightGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 18);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffee0,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const headlightMesh = new THREE.Mesh(lightGeo, lightMat);
    headlightMesh.rotation.x = Math.PI / 2;
    headlightMesh.position.set(xOffset, 0.62, 2.21);
    root.add(headlightMesh);
    headlightMeshes.push(headlightMesh);

    if (idx === 0 || idx === 3) {
      const spot = new THREE.SpotLight(0xfff5d0, 8, 45, Math.PI / 5, 0.4);
      spot.position.set(xOffset, 0.62, 2.22);
      spot.target.position.set(xOffset, 0.2, 15);
      root.add(spot);
      root.add(spot.target);
      headlights.push(spot);
    }
  });

  // Front Amber Turn Indicators
  const hazardMeshes: THREE.Mesh[] = [];
  [-0.72, 0.72].forEach((x) => {
    const indGeo = new THREE.BoxGeometry(0.18, 0.06, 0.04);
    const indMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
    });
    const indicator = new THREE.Mesh(indGeo, indMat);
    indicator.position.set(x, 0.42, 2.3);
    root.add(indicator);
    hazardMeshes.push(indicator);
  });

  // Fiat 132 Front License Plate
  const plateGeo = new THREE.BoxGeometry(0.48, 0.12, 0.02);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.38, 2.31);
  root.add(plate);

  // Taillights
  const taillightMeshes: THREE.Mesh[] = [];
  [-0.6, 0.6].forEach((x) => {
    const tailGeo = new THREE.BoxGeometry(0.38, 0.16, 0.04);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.6,
    });
    const taillight = new THREE.Mesh(tailGeo, tailMat);
    taillight.position.set(x, 0.62, -2.2);
    root.add(taillight);
    taillightMeshes.push(taillight);
  });

  // -------------------------------------------------------------------------
  // FIAT 132 DETAILED 3D COCKPIT INTERIOR
  // -------------------------------------------------------------------------
  // Interior Floor Carpet
  const floorGeo = new THREE.BoxGeometry(1.68, 0.04, 2.3);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.9 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, 0.46, -0.15);
  root.add(floorMesh);

  // Front Seats: Vintage Fluted Vinyl
  const driverSeat = createSeat(0x3e2723, false);
  driverSeat.position.set(-0.38, 0, 0);
  root.add(driverSeat);

  const passSeat = createSeat(0x3e2723, false);
  passSeat.position.set(0.38, 0, 0);
  root.add(passSeat);

  // Rear Bench Seat
  const rearBenchGeo = new THREE.BoxGeometry(1.54, 0.48, 0.48);
  const rearBench = new THREE.Mesh(rearBenchGeo, new THREE.MeshStandardMaterial({ color: 0x3e2723 }));
  rearBench.position.set(0, 0.72, -0.92);
  root.add(rearBench);

  // 1. Wood-Grain Dashboard Panel
  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.88, 0.68);

  const dashMainGeo = new THREE.BoxGeometry(1.58, 0.28, 0.42);
  const dashBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
  const dashMain = new THREE.Mesh(dashMainGeo, dashBlackMat);
  dashGroup.add(dashMain);

  // Italian Mahogany Wood-Grain Fascia Panel
  const woodFasciaGeo = new THREE.BoxGeometry(1.54, 0.16, 0.03);
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6e3b15, // warm mahogany wood grain
    roughness: 0.32,
    metalness: 0.08,
  });
  const woodFascia = new THREE.Mesh(woodFasciaGeo, woodMat);
  woodFascia.position.set(0, 0.01, -0.21);
  dashGroup.add(woodFascia);

  // Horizontal Chrome Bead Accent
  const chromeBeadGeo = new THREE.BoxGeometry(1.54, 0.015, 0.035);
  const chromeBead = new THREE.Mesh(chromeBeadGeo, chromeMat);
  chromeBead.position.set(0, 0.09, -0.21);
  dashGroup.add(chromeBead);

  // 2. 4 Recessed Circular Analog Gauges in Driver Instrument Binnacle
  const gaugeClusterGroup = new THREE.Group();
  gaugeClusterGroup.position.set(-0.38, 0.03, -0.22);
  gaugeClusterGroup.rotation.x = -0.18; // angled slightly up toward driver eye

  // Speedometer (Large Circular Gauge)
  const fiatSpeedGauge = createAnalogGauge(0.065, 0xf3f4f6, 0x111827, 0xef4444);
  fiatSpeedGauge.group.position.set(-0.085, 0, 0);
  gaugeClusterGroup.add(fiatSpeedGauge.group);

  // Tachometer / RPM (Large Circular Gauge)
  const fiatRpmGauge = createAnalogGauge(0.065, 0xf3f4f6, 0x111827, 0xef4444);
  fiatRpmGauge.group.position.set(0.085, 0, 0);
  gaugeClusterGroup.add(fiatRpmGauge.group);

  // 2 Auxiliary Gauges (Water Temp & Fuel)
  const fiatTempGauge = createAnalogGauge(0.035, 0xf3f4f6, 0x111827, 0xef4444);
  fiatTempGauge.group.position.set(0.20, 0.02, 0);
  gaugeClusterGroup.add(fiatTempGauge.group);

  const fiatFuelGauge = createAnalogGauge(0.035, 0xf3f4f6, 0x111827, 0xef4444);
  fiatFuelGauge.group.position.set(0.20, -0.04, 0);
  gaugeClusterGroup.add(fiatFuelGauge.group);

  dashGroup.add(gaugeClusterGroup);
  root.add(dashGroup);

  // 3. Classic 2-Spoke Steering Wheel with Moving Rotation
  const steeringColumnGroup = new THREE.Group();
  steeringColumnGroup.position.set(-0.38, 0.88, 0.52);
  steeringColumnGroup.rotation.x = Math.PI / 4.2; // angled towards driver

  // Column tube
  const colTubeGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.28, 12);
  const colTube = new THREE.Mesh(colTubeGeo, blackPlasticMat);
  colTube.position.y = 0.05;
  steeringColumnGroup.add(colTube);

  // Rotating Steering Wheel Group
  const interiorSteerWheel = new THREE.Group();
  interiorSteerWheel.position.y = 0.16;

  // Vintage Rim (Wood/Bakelite)
  const steerRimGeo = new THREE.TorusGeometry(0.18, 0.016, 12, 32);
  const vintageRimMat = new THREE.MeshStandardMaterial({
    color: 0x2b1810,
    roughness: 0.4,
    metalness: 0.1,
  });
  const steerRim = new THREE.Mesh(steerRimGeo, vintageRimMat);
  interiorSteerWheel.add(steerRim);

  // Two Classic Horizontal Spokes
  const spokeGeo = new THREE.BoxGeometry(0.32, 0.022, 0.015);
  const spokeMesh = new THREE.Mesh(spokeGeo, chromeMat);
  interiorSteerWheel.add(spokeMesh);

  // Center Horn Button with Fiat Crest
  const hornGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b, // vintage red Fiat crest
    metalness: 0.6,
    roughness: 0.3,
  });
  const hornMesh = new THREE.Mesh(hornGeo, hornMat);
  hornMesh.rotation.x = Math.PI / 2;
  interiorSteerWheel.add(hornMesh);

  steeringColumnGroup.add(interiorSteerWheel);
  root.add(steeringColumnGroup);

  // 4. Center Console & Animated Manual Gear Stick
  const centerConsoleGeo = new THREE.BoxGeometry(0.22, 0.2, 0.72);
  const centerConsole = new THREE.Mesh(centerConsoleGeo, blackPlasticMat);
  centerConsole.position.set(0, 0.54, 0.25);
  root.add(centerConsole);

  // Shifter Pivot Group
  const gearStickGroup = new THREE.Group();
  gearStickGroup.position.set(0, 0.64, 0.32);

  // Leather Gaiter Boot
  const bootGeo = new THREE.ConeGeometry(0.055, 0.08, 12);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
  const boot = new THREE.Mesh(bootGeo, bootMat);
  boot.position.y = 0.04;
  gearStickGroup.add(boot);

  // Chrome Shift Lever Shaft
  const shaftGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.18, 10);
  const shaft = new THREE.Mesh(shaftGeo, chromeMat);
  shaft.position.y = 0.13;
  gearStickGroup.add(shaft);

  // Spherical Shift Knob
  const knobGeo = new THREE.SphereGeometry(0.024, 16, 16);
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.3 });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.position.y = 0.22;
  gearStickGroup.add(knob);

  root.add(gearStickGroup);

  // Windshield Rear-View Mirror
  const fiatMirror = createWindshieldMirror();
  fiatMirror.position.set(0, 1.25, 0.85);
  root.add(fiatMirror);

  // Wheels Setup
  const wheelRadius = 0.35;
  const wheelWidth = 0.22;
  const trackWidth = 0.85;
  const wheelbaseFront = 1.35;
  const wheelbaseRear = -1.35;

  const fl = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const fr = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const rl = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);
  const rr = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);

  const flPivot = new THREE.Group();
  flPivot.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseFront);
  fl.wheelGroup.rotation.y = Math.PI;
  flPivot.add(fl.wheelGroup);
  root.add(flPivot);

  const frPivot = new THREE.Group();
  frPivot.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseFront);
  frPivot.add(fr.wheelGroup);
  root.add(frPivot);

  const rlGroup = rl.wheelGroup;
  rlGroup.rotation.y = Math.PI;
  rlGroup.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseRear);
  root.add(rlGroup);

  const rrGroup = rr.wheelGroup;
  rrGroup.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseRear);
  root.add(rrGroup);

  // Underglow
  let underglow: THREE.PointLight | null = null;
  if (custom.neonUnderglow) {
    underglow = new THREE.PointLight(new THREE.Color(custom.neonUnderglow), 4, 3);
    underglow.position.set(0, 0.12, 0);
    root.add(underglow);
  }

  return {
    group: root,
    wheels: [fl.wheelGroup, fr.wheelGroup, rlGroup, rrGroup],
    frontLeftWheel: flPivot,
    frontRightWheel: frPivot,
    rearLeftWheel: rlGroup,
    rearRightWheel: rrGroup,
    headlights,
    headlightMeshes,
    taillightMeshes,
    hazardMeshes,
    underglowLight: underglow,
    bodyMesh: lowerBody,
    bodyMaterial: bodyMat,
    rimMaterial: fl.rimMat,
    interiorSteeringWheel: interiorSteerWheel,
    gearStick: gearStickGroup,
    rearViewMirror: fiatMirror,
    updateCustomization: (newCustom: CarCustomization) => {
      bodyMat.color.set(newCustom.bodyColor);
      fl.rimMat.color.set(newCustom.rimColor);
      fr.rimMat.color.set(newCustom.rimColor);
      rl.rimMat.color.set(newCustom.rimColor);
      rr.rimMat.color.set(newCustom.rimColor);
      glassMat.opacity = 0.65 - (newCustom.windowTint || 0) * 0.35;
      if (underglow && newCustom.neonUnderglow) {
        underglow.color.set(newCustom.neonUnderglow);
        underglow.visible = true;
      } else if (underglow) {
        underglow.visible = false;
      }
    },
    setBraking: (braking: boolean) => {
      taillightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = braking ? 2.5 : 0.6;
        mat.emissive.setHex(braking ? 0xff0000 : 0x991b1b);
      });
    },
    setHeadlights: (on: boolean) => {
      headlights.forEach((light) => (light.intensity = on ? 8 : 0));
      headlightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 1.4 : 0.1;
      });
    },
    setHazards: (on: boolean) => {
      hazardMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 2.0 : 0.1;
      });
    },
    setSteeringAngle: (rad: number) => {
      flPivot.rotation.y = rad;
      frPivot.rotation.y = rad;
    },
    spinWheels: (speedDelta: number) => {
      fl.wheelGroup.rotation.x += speedDelta;
      fr.wheelGroup.rotation.x += speedDelta;
      rlGroup.rotation.x += speedDelta;
      rrGroup.rotation.x += speedDelta;
    },
    updateCockpitTelemetry: (speedKmh: number, rpm: number, gear: number, steeringRatio: number) => {
      // 1. Rotate 3D Interior Steering Wheel with player steering
      interiorSteerWheel.rotation.z = -steeringRatio * Math.PI * 1.6;

      // 2. Animate Speedometer and RPM needles
      fiatSpeedGauge.setNormalizedValue(speedKmh / 200);
      fiatRpmGauge.setNormalizedValue((rpm - 800) / (7200 - 800));

      // 3. Animate Manual Gear Stick Gate Position
      let targetX = 0;
      let targetZ = 0;
      switch (gear) {
        case 1:
          targetX = -0.15;
          targetZ = -0.12;
          break;
        case 2:
          targetX = 0.15;
          targetZ = -0.12;
          break;
        case 3:
          targetX = -0.15;
          targetZ = 0.0;
          break;
        case 4:
          targetX = 0.15;
          targetZ = 0.0;
          break;
        case 5:
          targetX = -0.15;
          targetZ = 0.12;
          break;
        case -1: // Reverse
          targetX = 0.15;
          targetZ = 0.14;
          break;
        default: // Neutral
          targetX = 0;
          targetZ = 0;
          break;
      }
      gearStickGroup.rotation.z = targetZ;
      gearStickGroup.rotation.x = targetX;
    },
  };
}

// 2. CHEVROLET OPTRA 2012 - Modern Sedan Builder
export function buildOptra2012(specs: CarSpecs, custom: CarCustomization): Car3DObject {
  const root = new THREE.Group();
  root.name = 'Optra2012_Root';

  // Obsidian Gloss Black
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.bodyColor || specs.defaultColor),
    metalness: 0.85,
    roughness: 0.22,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.12,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.25,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.7 - (custom.windowTint || 0) * 0.4,
    roughness: 0.08,
  });

  const blackPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.7,
    metalness: 0.2,
  });

  // Aerodynamic Modern Lower Sedan Body
  const bodyGeo = new THREE.BoxGeometry(1.82, 0.54, 4.48);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.54;
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Modern Roof Panel (Hollow interior cabin)
  const roofGeo = new THREE.BoxGeometry(1.66, 0.04, 2.38);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 1.34, -0.12);
  roof.castShadow = true;
  root.add(roof);

  // Curved Aerodynamic Pillars
  [-0.82, 0.82].forEach((x) => {
    // A-Pillars
    const aPillarGeo = new THREE.BoxGeometry(0.06, 0.55, 0.08);
    const aPillar = new THREE.Mesh(aPillarGeo, bodyMat);
    aPillar.position.set(x, 1.08, 0.72);
    aPillar.rotation.x = -Math.PI / 4.1;
    root.add(aPillar);

    // B-Pillars
    const bPillarGeo = new THREE.BoxGeometry(0.06, 0.54, 0.08);
    const bPillar = new THREE.Mesh(bPillarGeo, bodyMat);
    bPillar.position.set(x, 1.08, -0.12);
    root.add(bPillar);

    // C-Pillars
    const cPillarGeo = new THREE.BoxGeometry(0.06, 0.54, 0.16);
    const cPillar = new THREE.Mesh(cPillarGeo, bodyMat);
    cPillar.position.set(x, 1.08, -1.1);
    cPillar.rotation.x = Math.PI / 3.9;
    root.add(cPillar);
  });

  // Curved Windshields
  const frontWindshieldGeo = new THREE.PlaneGeometry(1.6, 0.76);
  const frontWindshield = new THREE.Mesh(frontWindshieldGeo, glassMat);
  frontWindshield.position.set(0, 1.08, 1.15);
  frontWindshield.rotation.x = -Math.PI / 4.1;
  root.add(frontWindshield);

  const rearWindshieldGeo = new THREE.PlaneGeometry(1.6, 0.74);
  const rearWindshield = new THREE.Mesh(rearWindshieldGeo, glassMat);
  rearWindshield.position.set(0, 1.06, -1.42);
  rearWindshield.rotation.x = Math.PI / 3.9;
  rearWindshield.rotation.y = Math.PI;
  root.add(rearWindshield);

  // Side Windows
  [-0.83, 0.83].forEach((x) => {
    const sideWinGeo = new THREE.PlaneGeometry(2.1, 0.46);
    const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
    sideWin.position.set(x, 1.08, -0.12);
    sideWin.rotation.y = Math.PI / 2;
    root.add(sideWin);
  });

  // Split Grille
  const upperGrilleGeo = new THREE.BoxGeometry(1.3, 0.12, 0.05);
  const upperGrille = new THREE.Mesh(upperGrilleGeo, chromeMat);
  upperGrille.position.set(0, 0.65, 2.25);
  root.add(upperGrille);

  const lowerGrilleGeo = new THREE.BoxGeometry(1.4, 0.14, 0.05);
  const lowerGrille = new THREE.Mesh(lowerGrilleGeo, chromeMat);
  lowerGrille.position.set(0, 0.45, 2.25);
  root.add(lowerGrille);

  // Golden Chevrolet Bowtie Emblem
  const bowtieGeo = new THREE.BoxGeometry(0.16, 0.08, 0.04);
  const bowtie = new THREE.Mesh(bowtieGeo, goldMat);
  bowtie.position.set(0, 0.65, 2.28);
  root.add(bowtie);

  // Swept-Back Cat-Eye Headlights
  const headlightMeshes: THREE.Mesh[] = [];
  const headlights: THREE.SpotLight[] = [];
  [-0.66, 0.66].forEach((x) => {
    const lightGeo = new THREE.BoxGeometry(0.34, 0.18, 0.12);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      roughness: 0.15,
    });
    const headlightMesh = new THREE.Mesh(lightGeo, lightMat);
    headlightMesh.position.set(x, 0.64, 2.22);
    headlightMesh.rotation.y = (x > 0 ? -1 : 1) * 0.18;
    root.add(headlightMesh);
    headlightMeshes.push(headlightMesh);

    const spot = new THREE.SpotLight(0xf8fafc, 8.5, 50, Math.PI / 4.8, 0.35);
    spot.position.set(x, 0.64, 2.25);
    spot.target.position.set(x, 0.2, 16);
    root.add(spot);
    root.add(spot.target);
    headlights.push(spot);
  });

  // Fog Lights
  const hazardMeshes: THREE.Mesh[] = [];
  [-0.68, 0.68].forEach((x) => {
    const fogGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
    const fogMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
    });
    const fogMesh = new THREE.Mesh(fogGeo, fogMat);
    fogMesh.rotation.x = Math.PI / 2;
    fogMesh.position.set(x, 0.35, 2.26);
    root.add(fogMesh);
    hazardMeshes.push(fogMesh);
  });

  // Taillights
  const taillightMeshes: THREE.Mesh[] = [];
  [-0.68, 0.68].forEach((x) => {
    const tailGeo = new THREE.BoxGeometry(0.38, 0.2, 0.08);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 0.65,
    });
    const taillight = new THREE.Mesh(tailGeo, tailMat);
    taillight.position.set(x, 0.68, -2.25);
    taillight.rotation.y = (x > 0 ? 1 : -1) * 0.15;
    root.add(taillight);
    taillightMeshes.push(taillight);
  });

  // Side Mirrors
  [-0.95, 0.95].forEach((x) => {
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
    const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
    mirror.position.set(x, 0.88, 0.85);
    root.add(mirror);
  });

  // -------------------------------------------------------------------------
  // CHEVROLET OPTRA 2012 DETAILED 3D COCKPIT INTERIOR
  // -------------------------------------------------------------------------
  // Interior Floor Carpet
  const floorGeo = new THREE.BoxGeometry(1.72, 0.04, 2.4);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, 0.46, -0.12);
  root.add(floorMesh);

  // Modern Two-Tone Front Bucket Seats
  const optraDriverSeat = createSeat(0x334155, true);
  optraDriverSeat.position.set(-0.38, 0, 0);
  root.add(optraDriverSeat);

  const optraPassSeat = createSeat(0x334155, true);
  optraPassSeat.position.set(0.38, 0, 0);
  root.add(optraPassSeat);

  // 1. Modern Two-Tone Grey / Black Dashboard
  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.92, 0.72);

  // Upper Matte Charcoal Dashboard Pad
  const upperDashGeo = new THREE.BoxGeometry(1.62, 0.18, 0.48);
  const upperDashMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65 });
  const upperDash = new THREE.Mesh(upperDashGeo, upperDashMat);
  dashGroup.add(upperDash);

  // Lower Medium Grey Fascia
  const lowerDashGeo = new THREE.BoxGeometry(1.6, 0.16, 0.44);
  const lowerDashMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55 });
  const lowerDash = new THREE.Mesh(lowerDashGeo, lowerDashMat);
  lowerDash.position.set(0, -0.12, 0.02);
  dashGroup.add(lowerDash);

  // Silver Metallic Accent Trim Bar
  const silverTrimGeo = new THREE.BoxGeometry(1.58, 0.02, 0.46);
  const silverTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
  const silverTrim = new THREE.Mesh(silverTrimGeo, silverTrimMat);
  silverTrim.position.set(0, -0.04, 0.01);
  dashGroup.add(silverTrim);

  // Air Conditioning Vents with Silver Bezels
  [-0.65, -0.15, 0.15, 0.65].forEach((vx) => {
    const ventGeo = new THREE.BoxGeometry(0.12, 0.06, 0.02);
    const vent = new THREE.Mesh(ventGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }));
    vent.position.set(vx, 0.02, -0.24);
    dashGroup.add(vent);
  });

  // 2. Center Infotainment Screen (7-inch Multimedia Touchscreen)
  const screenBoxGeo = new THREE.BoxGeometry(0.28, 0.18, 0.03);
  const screenBoxMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
  const screenBox = new THREE.Mesh(screenBoxGeo, screenBoxMat);
  screenBox.position.set(0, -0.06, -0.23);
  dashGroup.add(screenBox);

  // Glowing Navigation Map Display
  const screenFaceGeo = new THREE.PlaneGeometry(0.24, 0.14);
  const screenFaceMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x00f0ff,
    emissiveIntensity: 0.8,
  });
  const screenFace = new THREE.Mesh(screenFaceGeo, screenFaceMat);
  screenFace.position.set(0, -0.06, -0.248);
  screenFace.rotation.y = Math.PI;
  dashGroup.add(screenFace);

  // 3. Backlit White / Cyan-Blue Instrument Cluster
  const clusterGroup = new THREE.Group();
  clusterGroup.position.set(-0.38, 0.04, -0.24);
  clusterGroup.rotation.x = -0.16;

  // Cluster Visor Hood
  const visorGeo = new THREE.BoxGeometry(0.48, 0.05, 0.18);
  const visor = new THREE.Mesh(visorGeo, upperDashMat);
  visor.position.set(0, 0.08, 0.04);
  clusterGroup.add(visor);

  // Cyan-Blue Backlit Speedometer & Tachometer
  const optraSpeedGauge = createAnalogGauge(
    0.07,
    0x94a3b8,
    0x0a0f1d,
    0xffffff,
    0x00f0ff, // glowing cyan-blue backlight
    -Math.PI * 0.72,
    Math.PI * 0.72
  );
  optraSpeedGauge.group.position.set(-0.09, 0, 0);
  clusterGroup.add(optraSpeedGauge.group);

  const optraRpmGauge = createAnalogGauge(
    0.07,
    0x94a3b8,
    0x0a0f1d,
    0xffffff,
    0x00f0ff, // glowing cyan-blue backlight
    -Math.PI * 0.72,
    Math.PI * 0.72
  );
  optraRpmGauge.group.position.set(0.09, 0, 0);
  clusterGroup.add(optraRpmGauge.group);

  dashGroup.add(clusterGroup);
  root.add(dashGroup);

  // 4. Modern 3-Spoke Steering Wheel with Gold Chevrolet Bowtie Emblem
  const optraSteerCol = new THREE.Group();
  optraSteerCol.position.set(-0.38, 0.90, 0.54);
  optraSteerCol.rotation.x = Math.PI / 4.4;

  const optraColTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.034, 0.26, 14),
    blackPlasticMat
  );
  optraColTube.position.y = 0.04;
  optraSteerCol.add(optraColTube);

  const optraSteerWheel = new THREE.Group();
  optraSteerWheel.position.y = 0.15;

  // Contoured Sport Wheel Rim
  const modernRimGeo = new THREE.TorusGeometry(0.175, 0.018, 14, 32);
  const modernRimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.15,
  });
  const modernRim = new THREE.Mesh(modernRimGeo, modernRimMat);
  optraSteerWheel.add(modernRim);

  // 3 Sculpted Spokes with Silver Inserts
  [0, Math.PI, -Math.PI / 2].forEach((angle) => {
    const spokeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.16, 0.02),
      silverTrimMat
    );
    spokeMesh.position.set(Math.cos(angle) * 0.08, Math.sin(angle) * 0.08, 0);
    spokeMesh.rotation.z = angle + Math.PI / 2;
    optraSteerWheel.add(spokeMesh);
  });

  // Center Airbag Horn Pad with Golden Bowtie
  const airbagPadGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.024, 18);
  const airbagPad = new THREE.Mesh(airbagPadGeo, blackPlasticMat);
  airbagPad.rotation.x = Math.PI / 2;
  optraSteerWheel.add(airbagPad);

  const miniBowtie = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.008), goldMat);
  miniBowtie.position.z = 0.015;
  optraSteerWheel.add(miniBowtie);

  optraSteerCol.add(optraSteerWheel);
  root.add(optraSteerCol);

  // Automatic Transmission Gated Shift Lever
  const optraConsoleGeo = new THREE.BoxGeometry(0.24, 0.22, 0.76);
  const optraConsole = new THREE.Mesh(optraConsoleGeo, blackPlasticMat);
  optraConsole.position.set(0, 0.56, 0.28);
  root.add(optraConsole);

  const autoShifterGroup = new THREE.Group();
  autoShifterGroup.position.set(0, 0.68, 0.36);

  const autoBezel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.22), silverTrimMat);
  autoShifterGroup.add(autoBezel);

  const autoLever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12),
    silverTrimMat
  );
  autoLever.position.y = 0.06;
  autoShifterGroup.add(autoLever);

  const autoKnob = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
  );
  autoKnob.position.y = 0.12;
  autoShifterGroup.add(autoKnob);
  root.add(autoShifterGroup);

  // Windshield Rear-View Mirror
  const optraMirror = createWindshieldMirror();
  optraMirror.position.set(0, 1.28, 0.95);
  root.add(optraMirror);

  // Wheels Setup
  const wheelRadius = 0.36;
  const wheelWidth = 0.23;
  const trackWidth = 0.88;
  const wheelbaseFront = 1.38;
  const wheelbaseRear = -1.38;

  const fl = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const fr = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const rl = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);
  const rr = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);

  const flPivot = new THREE.Group();
  flPivot.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseFront);
  fl.wheelGroup.rotation.y = Math.PI;
  flPivot.add(fl.wheelGroup);
  root.add(flPivot);

  const frPivot = new THREE.Group();
  frPivot.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseFront);
  frPivot.add(fr.wheelGroup);
  root.add(frPivot);

  const rlGroup = rl.wheelGroup;
  rlGroup.rotation.y = Math.PI;
  rlGroup.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseRear);
  root.add(rlGroup);

  const rrGroup = rr.wheelGroup;
  rrGroup.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || 0), wheelbaseRear);
  root.add(rrGroup);

  // Underglow
  let underglow: THREE.PointLight | null = null;
  if (custom.neonUnderglow) {
    underglow = new THREE.PointLight(new THREE.Color(custom.neonUnderglow), 4, 3);
    underglow.position.set(0, 0.12, 0);
    root.add(underglow);
  }

  return {
    group: root,
    wheels: [fl.wheelGroup, fr.wheelGroup, rlGroup, rrGroup],
    frontLeftWheel: flPivot,
    frontRightWheel: frPivot,
    rearLeftWheel: rlGroup,
    rearRightWheel: rrGroup,
    headlights,
    headlightMeshes,
    taillightMeshes,
    hazardMeshes,
    underglowLight: underglow,
    bodyMesh,
    bodyMaterial: bodyMat,
    rimMaterial: fl.rimMat,
    interiorSteeringWheel: optraSteerWheel,
    gearStick: autoShifterGroup,
    rearViewMirror: optraMirror,
    updateCustomization: (newCustom: CarCustomization) => {
      bodyMat.color.set(newCustom.bodyColor);
      fl.rimMat.color.set(newCustom.rimColor);
      fr.rimMat.color.set(newCustom.rimColor);
      rl.rimMat.color.set(newCustom.rimColor);
      rr.rimMat.color.set(newCustom.rimColor);
      glassMat.opacity = 0.7 - (newCustom.windowTint || 0) * 0.4;
      if (underglow && newCustom.neonUnderglow) {
        underglow.color.set(newCustom.neonUnderglow);
        underglow.visible = true;
      } else if (underglow) {
        underglow.visible = false;
      }
    },
    setBraking: (braking: boolean) => {
      taillightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = braking ? 2.5 : 0.65;
        mat.emissive.setHex(braking ? 0xff0000 : 0x7f1d1d);
      });
    },
    setHeadlights: (on: boolean) => {
      headlights.forEach((light) => (light.intensity = on ? 8.5 : 0));
      headlightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 1.5 : 0.1;
      });
    },
    setHazards: (on: boolean) => {
      hazardMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 2.2 : 0.1;
      });
    },
    setSteeringAngle: (rad: number) => {
      flPivot.rotation.y = rad;
      frPivot.rotation.y = rad;
    },
    spinWheels: (speedDelta: number) => {
      fl.wheelGroup.rotation.x += speedDelta;
      fr.wheelGroup.rotation.x += speedDelta;
      rlGroup.rotation.x += speedDelta;
      rrGroup.rotation.x += speedDelta;
    },
    updateCockpitTelemetry: (speedKmh: number, rpm: number, gear: number, steeringRatio: number) => {
      optraSteerWheel.rotation.z = -steeringRatio * Math.PI * 1.5;
      optraSpeedGauge.setNormalizedValue(speedKmh / 220);
      optraRpmGauge.setNormalizedValue((rpm - 800) / (6800 - 800));

      // Automatic Shift Lever Position
      if (gear === -1) {
        autoShifterGroup.position.z = 0.32; // R
      } else if (gear === 0) {
        autoShifterGroup.position.z = 0.34; // N
      } else {
        autoShifterGroup.position.z = 0.37; // D
      }
    },
  };
}

// 3. BMW E30 (325i) - Iconic German Drift Legend Builder
export function buildBmwE30(specs: CarSpecs, custom: CarCustomization): Car3DObject {
  const root = new THREE.Group();
  root.name = 'BmwE30_Root';

  // Titanium Silver High-Contrast Metallic
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.bodyColor || specs.defaultColor),
    metalness: 0.9,
    roughness: 0.18,
  });

  const blackTrimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.3,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.98,
    roughness: 0.08,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    transparent: true,
    opacity: 0.7 - (custom.windowTint || 0) * 0.45,
    roughness: 0.08,
  });

  // Boxy 1980s German Chassis
  const bodyGeo = new THREE.BoxGeometry(1.74, 0.52, 4.34);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.52;
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Cabin Roof Panel (Open hollow interior cabin)
  const roofGeo = new THREE.BoxGeometry(1.58, 0.04, 2.22);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 1.28, -0.15);
  roof.castShadow = true;
  root.add(roof);

  // Iconic Thin Slanted A, B, and C Pillars
  [-0.78, 0.78].forEach((x) => {
    // A-Pillars
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.06), bodyMat);
    aPillar.position.set(x, 1.04, 0.6);
    aPillar.rotation.x = -Math.PI / 4.6;
    root.add(aPillar);

    // B-Pillars
    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.07), blackTrimMat);
    bPillar.position.set(x, 1.04, -0.15);
    root.add(bPillar);

    // C-Pillars (Classic Hofmeister kink)
    const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.16), bodyMat);
    cPillar.position.set(x, 1.04, -1.02);
    cPillar.rotation.x = Math.PI / 4.2;
    root.add(cPillar);
  });

  // Windshield & Windows
  const frontWindshieldGeo = new THREE.PlaneGeometry(1.52, 0.66);
  const frontWindshield = new THREE.Mesh(frontWindshieldGeo, glassMat);
  frontWindshield.position.set(0, 1.02, 0.98);
  frontWindshield.rotation.x = -Math.PI / 4.6;
  root.add(frontWindshield);

  const rearWindshieldGeo = new THREE.PlaneGeometry(1.52, 0.65);
  const rearWindshield = new THREE.Mesh(rearWindshieldGeo, glassMat);
  rearWindshield.position.set(0, 1.02, -1.28);
  rearWindshield.rotation.x = Math.PI / 4.2;
  rearWindshield.rotation.y = Math.PI;
  root.add(rearWindshield);

  [-0.79, 0.79].forEach((x) => {
    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.44), glassMat);
    sideWin.position.set(x, 1.03, -0.15);
    sideWin.rotation.y = Math.PI / 2;
    root.add(sideWin);
  });

  // M-Tech Front Air Dam
  const frontValanceGeo = new THREE.BoxGeometry(1.76, 0.22, 0.3);
  const frontValance = new THREE.Mesh(frontValanceGeo, bodyMat);
  frontValance.position.set(0, 0.28, 2.12);
  root.add(frontValance);

  // Rear Trunk Lip Spoiler
  const spoilerGeo = new THREE.BoxGeometry(1.56, 0.06, 0.18);
  const spoiler = new THREE.Mesh(spoilerGeo, blackTrimMat);
  spoiler.position.set(0, 0.81, -2.14);
  root.add(spoiler);

  // Dual Kidney Grille with Chrome Surrounds
  [-0.12, 0.12].forEach((x) => {
    const kidneyGeo = new THREE.BoxGeometry(0.18, 0.22, 0.04);
    const kidney = new THREE.Mesh(kidneyGeo, chromeMat);
    kidney.position.set(x, 0.62, 2.18);
    root.add(kidney);

    const innerGeo = new THREE.BoxGeometry(0.14, 0.18, 0.05);
    const inner = new THREE.Mesh(innerGeo, blackTrimMat);
    inner.position.set(x, 0.62, 2.19);
    root.add(inner);
  });

  // Black Plastic Front Grille Surround
  const surroundGeo = new THREE.BoxGeometry(1.64, 0.26, 0.03);
  const surround = new THREE.Mesh(surroundGeo, blackTrimMat);
  surround.position.set(0, 0.62, 2.17);
  root.add(surround);

  // Quad Circular Headlights
  const headlightMeshes: THREE.Mesh[] = [];
  const headlights: THREE.SpotLight[] = [];
  const e30HeadlightOffsets = [-0.64, -0.42, 0.42, 0.64];

  e30HeadlightOffsets.forEach((x, idx) => {
    const lightGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffef0,
      emissiveIntensity: 1.3,
      roughness: 0.1,
    });
    const headlightMesh = new THREE.Mesh(lightGeo, lightMat);
    headlightMesh.rotation.x = Math.PI / 2;
    headlightMesh.position.set(x, 0.62, 2.2);
    root.add(headlightMesh);
    headlightMeshes.push(headlightMesh);

    if (idx === 0 || idx === 3) {
      const spot = new THREE.SpotLight(0xfff7ed, 9, 55, Math.PI / 4.5, 0.3);
      spot.position.set(x, 0.62, 2.22);
      spot.target.position.set(x, 0.2, 18);
      root.add(spot);
      root.add(spot.target);
      headlights.push(spot);
    }
  });

  // M-Tech Lower Valance Fog Lights
  const hazardMeshes: THREE.Mesh[] = [];
  [-0.56, 0.56].forEach((x) => {
    const fogGeo = new THREE.BoxGeometry(0.16, 0.08, 0.05);
    const fogMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
    });
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.position.set(x, 0.32, 2.26);
    root.add(fog);
    hazardMeshes.push(fog);
  });

  // Taillights
  const taillightMeshes: THREE.Mesh[] = [];
  [-0.6, 0.6].forEach((x) => {
    const tailGeo = new THREE.BoxGeometry(0.38, 0.22, 0.06);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.7,
    });
    const taillight = new THREE.Mesh(tailGeo, tailMat);
    taillight.position.set(x, 0.64, -2.18);
    root.add(taillight);
    taillightMeshes.push(taillight);
  });

  // Dual Stainless Exhaust Pipes
  [-0.48, -0.42].forEach((x) => {
    const pipeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 16);
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.1,
    });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.28, -2.25);
    root.add(pipe);
  });

  // -------------------------------------------------------------------------
  // BMW E30 DETAILED 3D COCKPIT INTERIOR
  // -------------------------------------------------------------------------
  // Interior Floor Carpet
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.04, 2.25),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
  );
  floorMesh.position.set(0, 0.46, -0.15);
  root.add(floorMesh);

  // M-Tech Recaro Sport Bucket Seats with Deep Bolsters
  const e30DriverSeat = createSeat(0x18181b, true);
  e30DriverSeat.position.set(-0.38, 0, 0);
  root.add(e30DriverSeat);

  const e30PassSeat = createSeat(0x18181b, true);
  e30PassSeat.position.set(0.38, 0, 0);
  root.add(e30PassSeat);

  // 1. Dashboard Assembly with Iconic Driver-Angled Center Console
  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.88, 0.65);

  // Main Dashboard Slab
  const dashMain = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.26, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65 })
  );
  dashGroup.add(dashMain);

  // Iconic Center Console Angled ~15 degrees towards Driver
  const angledConsoleGroup = new THREE.Group();
  angledConsoleGroup.position.set(0.02, -0.04, -0.22);
  angledConsoleGroup.rotation.y = -0.26; // ~15 degrees turned towards driver seat!

  const consoleBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.22, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
  );
  angledConsoleGroup.add(consoleBox);

  // Bavarian Radio Cassette Player & Climate Control Sliders
  const radioFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xf97316, // amber radio backlighting
      emissiveIntensity: 0.35,
    })
  );
  radioFace.position.set(0, -0.04, -0.052);
  radioFace.rotation.y = Math.PI;
  angledConsoleGroup.add(radioFace);

  // Hazard Button (Red triangle)
  const hazardBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.035, 0.015),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.6 })
  );
  hazardBtn.position.set(0.1, 0.05, -0.052);
  angledConsoleGroup.add(hazardBtn);

  dashGroup.add(angledConsoleGroup);

  // 2. Glowing Amber/Orange Analog Dials in Recessed Driver Pod
  const clusterGroup = new THREE.Group();
  clusterGroup.position.set(-0.38, 0.04, -0.23);
  clusterGroup.rotation.x = -0.16;

  // Hooded Instrument Binnacle
  const clusterHood = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.06, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 })
  );
  clusterHood.position.set(0, 0.08, 0.04);
  clusterGroup.add(clusterHood);

  // Speedometer (0-260 KM/H with BMW amber glow)
  const e30SpeedGauge = createAnalogGauge(
    0.068,
    0x334155,
    0x0a0c10,
    0xf97316, // bright glowing amber needle
    0xf97316, // amber dial illumination
    -Math.PI * 0.72,
    Math.PI * 0.72
  );
  e30SpeedGauge.group.position.set(-0.085, 0, 0);
  clusterGroup.add(e30SpeedGauge.group);

  // Tachometer (0-7000 RPM with BMW amber glow)
  const e30RpmGauge = createAnalogGauge(
    0.068,
    0x334155,
    0x0a0c10,
    0xf97316, // glowing amber needle
    0xf97316, // amber dial illumination
    -Math.PI * 0.72,
    Math.PI * 0.72
  );
  e30RpmGauge.group.position.set(0.085, 0, 0);
  clusterGroup.add(e30RpmGauge.group);

  // Small Econometer / Fuel gauge below tachometer
  const e30EcoGauge = createAnalogGauge(0.03, 0x334155, 0x0a0c10, 0xf97316, 0xf97316);
  e30EcoGauge.group.position.set(0.085, -0.045, 0.005);
  clusterGroup.add(e30EcoGauge.group);

  dashGroup.add(clusterGroup);
  root.add(dashGroup);

  // 3. Classic 3-Spoke M-Tech Sport Steering Wheel
  const e30SteerCol = new THREE.Group();
  e30SteerCol.position.set(-0.38, 0.88, 0.50);
  e30SteerCol.rotation.x = Math.PI / 4.2;

  const e30ColTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.032, 0.26, 14),
    blackTrimMat
  );
  e30ColTube.position.y = 0.04;
  e30SteerCol.add(e30ColTube);

  const e30SteerWheel = new THREE.Group();
  e30SteerWheel.position.y = 0.16;

  // Thick M-Tech Sport Leather Rim
  const sportRimGeo = new THREE.TorusGeometry(0.165, 0.019, 14, 32);
  const sportRimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.2,
  });
  const sportRim = new THREE.Mesh(sportRimGeo, sportRimMat);
  e30SteerWheel.add(sportRim);

  // 3 Black Matte M-Tech Spokes
  [0, Math.PI, -Math.PI / 2].forEach((angle) => {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.15, 0.018),
      blackTrimMat
    );
    spoke.position.set(Math.cos(angle) * 0.075, Math.sin(angle) * 0.075, 0);
    spoke.rotation.z = angle + Math.PI / 2;
    e30SteerWheel.add(spoke);
  });

  // BMW Center Roundel (Blue/White quadrants + Chrome ring)
  const roundelBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.046, 0.02, 20),
    blackTrimMat
  );
  roundelBase.rotation.x = Math.PI / 2;
  e30SteerWheel.add(roundelBase);

  const bmwLogoFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.038, 20),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.2 })
  );
  bmwLogoFace.position.z = 0.012;
  e30SteerWheel.add(bmwLogoFace);

  // M Tri-color Stripe Accent on bottom spoke
  const mStripeGeo = new THREE.BoxGeometry(0.025, 0.015, 0.005);
  const mStripeMat = new THREE.MeshBasicMaterial({ color: 0x00a3e0 });
  const mStripe = new THREE.Mesh(mStripeGeo, mStripeMat);
  mStripe.position.set(0, -0.09, 0.012);
  e30SteerWheel.add(mStripe);

  e30SteerCol.add(e30SteerWheel);
  root.add(e30SteerCol);

  // M-Tech Manual Gear Shifter
  const e30Console = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.2, 0.72),
    blackTrimMat
  );
  e30Console.position.set(0, 0.55, 0.26);
  root.add(e30Console);

  const e30ShifterGroup = new THREE.Group();
  e30ShifterGroup.position.set(0, 0.65, 0.32);

  const e30Boot = new THREE.Mesh(
    new THREE.ConeGeometry(0.052, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
  );
  e30Boot.position.y = 0.04;
  e30ShifterGroup.add(e30Boot);

  const e30Shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10),
    chromeMat
  );
  e30Shaft.position.y = 0.12;
  e30ShifterGroup.add(e30Shaft);

  // Ergonomic M Shift Knob
  const e30Knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.015, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35 })
  );
  e30Knob.position.y = 0.20;
  e30ShifterGroup.add(e30Knob);
  root.add(e30ShifterGroup);

  // 4. Working Rear-View Mirror at Top of Windshield
  const e30Mirror = createWindshieldMirror();
  e30Mirror.position.set(0, 1.24, 0.82);
  root.add(e30Mirror);

  // Wheels Setup: Deep-Dish BBS Mesh Wheels
  const wheelRadius = 0.35;
  const wheelWidth = 0.25;
  const trackWidth = 0.86;
  const wheelbaseFront = 1.34;
  const wheelbaseRear = -1.34;

  const fl = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const fr = createWheel(wheelRadius, wheelWidth, custom.rimColor, true);
  const rl = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);
  const rr = createWheel(wheelRadius, wheelWidth, custom.rimColor, false);

  const flPivot = new THREE.Group();
  flPivot.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || -0.02), wheelbaseFront);
  fl.wheelGroup.rotation.y = Math.PI;
  flPivot.add(fl.wheelGroup);
  root.add(flPivot);

  const frPivot = new THREE.Group();
  frPivot.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || -0.02), wheelbaseFront);
  frPivot.add(fr.wheelGroup);
  root.add(frPivot);

  const rlGroup = rl.wheelGroup;
  rlGroup.rotation.y = Math.PI;
  rlGroup.position.set(-trackWidth, wheelRadius + (custom.suspensionHeight || -0.02), wheelbaseRear);
  root.add(rlGroup);

  const rrGroup = rr.wheelGroup;
  rrGroup.position.set(trackWidth, wheelRadius + (custom.suspensionHeight || -0.02), wheelbaseRear);
  root.add(rrGroup);

  // Underglow
  let underglow: THREE.PointLight | null = null;
  if (custom.neonUnderglow) {
    underglow = new THREE.PointLight(new THREE.Color(custom.neonUnderglow), 5, 3.2);
    underglow.position.set(0, 0.1, 0);
    root.add(underglow);
  }

  return {
    group: root,
    wheels: [fl.wheelGroup, fr.wheelGroup, rlGroup, rrGroup],
    frontLeftWheel: flPivot,
    frontRightWheel: frPivot,
    rearLeftWheel: rlGroup,
    rearRightWheel: rrGroup,
    headlights,
    headlightMeshes,
    taillightMeshes,
    hazardMeshes,
    underglowLight: underglow,
    bodyMesh,
    bodyMaterial: bodyMat,
    rimMaterial: fl.rimMat,
    interiorSteeringWheel: e30SteerWheel,
    gearStick: e30ShifterGroup,
    rearViewMirror: e30Mirror,
    updateCustomization: (newCustom: CarCustomization) => {
      bodyMat.color.set(newCustom.bodyColor);
      fl.rimMat.color.set(newCustom.rimColor);
      fr.rimMat.color.set(newCustom.rimColor);
      rl.rimMat.color.set(newCustom.rimColor);
      rr.rimMat.color.set(newCustom.rimColor);
      glassMat.opacity = 0.7 - (newCustom.windowTint || 0) * 0.45;
      if (underglow && newCustom.neonUnderglow) {
        underglow.color.set(newCustom.neonUnderglow);
        underglow.visible = true;
      } else if (underglow) {
        underglow.visible = false;
      }
    },
    setBraking: (braking: boolean) => {
      taillightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = braking ? 2.8 : 0.7;
        mat.emissive.setHex(braking ? 0xff0000 : 0x991b1b);
      });
    },
    setHeadlights: (on: boolean) => {
      headlights.forEach((light) => (light.intensity = on ? 9 : 0));
      headlightMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 1.6 : 0.1;
      });
    },
    setHazards: (on: boolean) => {
      hazardMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 2.4 : 0.1;
      });
    },
    setSteeringAngle: (rad: number) => {
      flPivot.rotation.y = rad;
      frPivot.rotation.y = rad;
    },
    spinWheels: (speedDelta: number) => {
      fl.wheelGroup.rotation.x += speedDelta;
      fr.wheelGroup.rotation.x += speedDelta;
      rlGroup.rotation.x += speedDelta;
      rrGroup.rotation.x += speedDelta;
    },
    updateCockpitTelemetry: (speedKmh: number, rpm: number, gear: number, steeringRatio: number) => {
      // 1. Rotate 3D M-Tech Sport Steering Wheel
      e30SteerWheel.rotation.z = -steeringRatio * Math.PI * 1.6;

      // 2. Animate Glowing Amber BMW Gauges
      e30SpeedGauge.setNormalizedValue(speedKmh / 240);
      e30RpmGauge.setNormalizedValue((rpm - 800) / (7200 - 800));
      e30EcoGauge.setNormalizedValue(Math.min(1.0, (speedKmh / 160) * 0.8 + 0.1));

      // 3. Animate M-Tech Manual Gear Shifter
      let targetX = 0;
      let targetZ = 0;
      switch (gear) {
        case 1:
          targetX = -0.16;
          targetZ = -0.13;
          break;
        case 2:
          targetX = 0.16;
          targetZ = -0.13;
          break;
        case 3:
          targetX = -0.16;
          targetZ = 0.0;
          break;
        case 4:
          targetX = 0.16;
          targetZ = 0.0;
          break;
        case 5:
          targetX = -0.16;
          targetZ = 0.13;
          break;
        case -1: // Reverse
          targetX = 0.16;
          targetZ = 0.15;
          break;
        default: // Neutral
          targetX = 0;
          targetZ = 0;
          break;
      }
      e30ShifterGroup.rotation.z = targetZ;
      e30ShifterGroup.rotation.x = targetX;
    },
  };
}

// Master Factory function
export function createCar3D(specs: CarSpecs, custom: CarCustomization): Car3DObject {
  switch (specs.id) {
    case 'optra_2012':
      return buildOptra2012(specs, custom);
    case 'bmw_e30':
      return buildBmwE30(specs, custom);
    case 'fiat_132':
    default:
      return buildFiat132(specs, custom);
  }
}
