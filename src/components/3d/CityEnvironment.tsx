import * as THREE from 'three';

export interface TrafficVehicle {
  id: number;
  type: 'taxi' | 'microbus' | 'sedan_silver' | 'sedan_red' | 'sedan_blue';
  group: THREE.Group;
  wheels: THREE.Group[];
  headlights: THREE.SpotLight[];
  x: number;
  z: number;
  speedMs: number;
  laneIndex: number;
  targetLaneIndex: number;
  laneChangeProgress: number;
  length: number;
  width: number;
}

export interface CityEnvironment {
  group: THREE.Group;
  checkpointMesh: THREE.Mesh;
  setCheckpointPosition: (x: number, z: number, visible: boolean) => void;
  updateAnimation: (
    time: number,
    delta?: number,
    playerX?: number,
    playerZ?: number,
    playerSpeedKmh?: number
  ) => void;
  checkTrafficCollision: (playerX: number, playerZ: number, playerRadius?: number) => boolean;
  onPlayerHorn: (playerX: number, playerZ: number) => void;
}

// Available road lanes (X coordinates on 4-lane highway)
const LANES = [-6.2, -2.1, 2.1, 6.2];

export function createCityEnvironment(): CityEnvironment {
  const root = new THREE.Group();
  root.name = 'CairoCityEnvironment_Root';

  // -------------------------------------------------------------
  // 1. HIGHWAY ROAD & LANE MARKINGS (Continuous Infinite Highway)
  // -------------------------------------------------------------
  const roadWidth = 20;
  const roadLength = 1200;

  // Asphalt Surface
  const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x14161c,
    roughness: 0.88,
    metalness: 0.12,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  // Center Double Yellow Line
  [-0.18, 0.18].forEach((offset) => {
    const lineGeo = new THREE.PlaneGeometry(0.14, roadLength);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(offset, 0.015, 0);
    root.add(line);
  });

  // White Dashed Lane Dividers (Between Lanes 1-2 and 3-4)
  [-4.15, 4.15].forEach((laneDividerX) => {
    for (let z = -roadLength / 2; z < roadLength / 2; z += 14) {
      const dashGeo = new THREE.PlaneGeometry(0.18, 6.5);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(laneDividerX, 0.015, z);
      root.add(dash);
    }
  });

  // Solid White Edge Lines
  [-8.8, 8.8].forEach((edgeX) => {
    const edgeGeo = new THREE.PlaneGeometry(0.25, roadLength);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(edgeX, 0.015, 0);
    root.add(edge);
  });

  // Concrete Curbs & Sidewalks
  [-9.5, 9.5].forEach((curbX) => {
    const curbGeo = new THREE.BoxGeometry(0.5, 0.25, roadLength);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(curbX, 0.125, 0);
    root.add(curb);

    const walkGeo = new THREE.BoxGeometry(6.5, 0.2, roadLength);
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
    });
    const sidewalk = new THREE.Mesh(walkGeo, walkMat);
    sidewalk.position.set(curbX > 0 ? curbX + 3.5 : curbX - 3.5, 0.1, 0);
    root.add(sidewalk);
  });

  // -------------------------------------------------------------
  // 2. THE RIVER NILE & CORNICHE PROMENADE (Left Side of Highway)
  // -------------------------------------------------------------
  const nileGroup = new THREE.Group();
  nileGroup.name = 'RiverNile_Corniche';

  // River Nile Water Plane with Waves
  const nileWaterGeo = new THREE.PlaneGeometry(160, roadLength, 32, 64);
  const nileWaterMat = new THREE.MeshStandardMaterial({
    color: 0x034752,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.92,
  });
  const nileWater = new THREE.Mesh(nileWaterGeo, nileWaterMat);
  nileWater.rotation.x = -Math.PI / 2;
  nileWater.position.set(-95, -0.6, 0);
  nileGroup.add(nileWater);

  // Historic Corniche Stone Balustrade (سور كورنيش النيل الحجري)
  for (let z = -roadLength / 2; z <= roadLength / 2; z += 6) {
    const balusterGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8);
    const balusterMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.9,
    });
    const baluster = new THREE.Mesh(balusterGeo, balusterMat);
    baluster.position.set(-13.0, 0.55, z);
    nileGroup.add(baluster);

    // Decorative brass river lamp atop pillars every 24m
    if (z % 24 === 0) {
      const lampHeadGeo = new THREE.SphereGeometry(0.22, 12, 12);
      const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const lampHead = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      lampHead.position.set(-13.0, 1.25, z);
      nileGroup.add(lampHead);

      const lampLight = new THREE.PointLight(0xfef08a, 1.5, 12);
      lampLight.position.set(-13.0, 1.3, z);
      nileGroup.add(lampLight);
    }
  }

  // Nile Promenade Handrail Beam
  const railGeo = new THREE.BoxGeometry(0.22, 0.12, roadLength);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.7,
  });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(-13.0, 1.0, 0);
  nileGroup.add(rail);

  // Floating Nile Feluccas (فلوكة نيلية بشراع أبيض وأنوار ملونة)
  const feluccaPositions = [
    { x: -35, z: -280 },
    { x: -50, z: -80 },
    { x: -38, z: 140 },
    { x: -65, z: 350 },
  ];
  const feluccaMeshes: THREE.Group[] = [];

  feluccaPositions.forEach((pos, idx) => {
    const felucca = new THREE.Group();
    felucca.position.set(pos.x, -0.4, pos.z);

    const hullGeo = new THREE.BoxGeometry(3.5, 0.9, 9);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.8,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    felucca.add(hull);

    const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 8.5, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 4.2, 1.0);
    felucca.add(mast);

    const sailGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 1.2, 0.8,
      0, 7.8, 1.0,
      -2.8, 2.5, -3.2,
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sailGeo.computeVertexNormals();
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    const sail = new THREE.Mesh(sailGeo, sailMat);
    felucca.add(sail);

    const colors = [0x00f0ff, 0xef4444, 0xf59e0b, 0x10b981];
    const light = new THREE.PointLight(colors[idx % colors.length], 3.0, 14);
    light.position.set(0, 1.8, 0);
    felucca.add(light);

    nileGroup.add(felucca);
    feluccaMeshes.push(felucca);
  });
  root.add(nileGroup);

  // -------------------------------------------------------------
  // 3. CAIRO TOWER LANDMARK (برج القاهرة الأيقوني باللوتس والأنوار)
  // -------------------------------------------------------------
  const towerGroup = new THREE.Group();
  towerGroup.name = 'CairoTower_Landmark';
  towerGroup.position.set(-110, 0, -220);

  const baseGeo = new THREE.CylinderGeometry(9, 11, 4, 16);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
  });
  const towerBase = new THREE.Mesh(baseGeo, baseMat);
  towerBase.position.y = 2;
  towerGroup.add(towerBase);

  const shaftGeo = new THREE.CylinderGeometry(4.2, 6.0, 72, 18, 8, true);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.8,
    roughness: 0.35,
    wireframe: true,
  });
  const towerShaft = new THREE.Mesh(shaftGeo, shaftMat);
  towerShaft.position.y = 40;
  towerGroup.add(towerShaft);

  const coreGeo = new THREE.CylinderGeometry(2.5, 3.8, 70, 12);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
  const towerCore = new THREE.Mesh(coreGeo, coreMat);
  towerCore.position.y = 40;
  towerGroup.add(towerCore);

  const lotusGeo = new THREE.CylinderGeometry(7.5, 4.2, 7.5, 16);
  const lotusMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x005577,
    emissiveIntensity: 0.8,
  });
  const towerTop = new THREE.Mesh(lotusGeo, lotusMat);
  towerTop.position.y = 79.5;
  towerGroup.add(towerTop);

  const spireGeo = new THREE.CylinderGeometry(0.15, 0.6, 14, 8);
  const spireMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
  const spire = new THREE.Mesh(spireGeo, spireMat);
  spire.position.y = 90;
  towerGroup.add(spire);

  const beaconLight = new THREE.PointLight(0xef4444, 8, 80);
  beaconLight.position.set(0, 97, 0);
  towerGroup.add(beaconLight);

  root.add(towerGroup);

  // -------------------------------------------------------------
  // 4. QASR EL NIL BRIDGE ARCHES & LIONS (كوبري قصر النيل التاريخي)
  // -------------------------------------------------------------
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'QasrElNil_Bridge';
  const bridgeZ = 60;
  bridgeGroup.position.set(0, 0, bridgeZ);

  const steelGreenMat = new THREE.MeshStandardMaterial({
    color: 0x166534,
    metalness: 0.8,
    roughness: 0.4,
  });

  [-10, 10].forEach((archX) => {
    const uprightGeo = new THREE.BoxGeometry(0.8, 12, 1.2);
    const upright = new THREE.Mesh(uprightGeo, steelGreenMat);
    upright.position.set(archX, 6, 0);
    bridgeGroup.add(upright);

    const archTopGeo = new THREE.BoxGeometry(0.8, 1.2, 55);
    const archTop = new THREE.Mesh(archTopGeo, steelGreenMat);
    archTop.position.set(archX, 12, 0);
    bridgeGroup.add(archTop);
  });

  for (let zOffset = -22; zOffset <= 22; zOffset += 11) {
    const crossBeamGeo = new THREE.BoxGeometry(20.8, 0.7, 0.7);
    const crossBeam = new THREE.Mesh(crossBeamGeo, steelGreenMat);
    crossBeam.position.set(0, 11.8, zOffset);
    bridgeGroup.add(crossBeam);
  }

  const lionStoneMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.95,
  });
  const lionPositions = [
    { x: -11.5, z: -30 },
    { x: 11.5, z: -30 },
    { x: -11.5, z: 30 },
    { x: 11.5, z: 30 },
  ];

  lionPositions.forEach((lPos) => {
    const lionPedestal = new THREE.Group();
    lionPedestal.position.set(lPos.x, 0, lPos.z);

    const plinthGeo = new THREE.BoxGeometry(2.4, 2.2, 4.2);
    const plinth = new THREE.Mesh(plinthGeo, lionStoneMat);
    plinth.position.y = 1.1;
    lionPedestal.add(plinth);

    const bodyGeo = new THREE.BoxGeometry(1.8, 1.4, 3.2);
    const body = new THREE.Mesh(bodyGeo, lionStoneMat);
    body.position.set(0, 2.8, 0);
    lionPedestal.add(body);

    const headGeo = new THREE.SphereGeometry(0.85, 10, 10);
    const head = new THREE.Mesh(headGeo, lionStoneMat);
    head.position.set(0, 3.6, lPos.z < 0 ? 1.4 : -1.4);
    lionPedestal.add(head);

    bridgeGroup.add(lionPedestal);
  });

  root.add(bridgeGroup);

  // -------------------------------------------------------------
  // 5. EGYPTIAN HIGHWAY OVERHEAD GANTRIES (لافتات الطرق السريعة)
  // -------------------------------------------------------------
  const gantryPositions = [-260, 240];
  gantryPositions.forEach((gZ) => {
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, gZ);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.3,
    });
    [-10.2, 10.2].forEach((xSide) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 0.5), frameMat);
      col.position.set(xSide, 4.25, 0);
      gantry.add(col);
    });

    const crossTruss = new THREE.Mesh(new THREE.BoxGeometry(21, 0.6, 0.6), frameMat);
    crossTruss.position.set(0, 8.2, 0);
    gantry.add(crossTruss);

    const signMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.5,
      emissive: 0x052e16,
      emissiveIntensity: 0.4,
    });

    const sign1 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 0.15), signMat);
    sign1.position.set(-4.5, 6.8, 0);
    gantry.add(sign1);

    const sign2 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 0.15), signMat);
    sign2.position.set(4.5, 6.8, 0);
    gantry.add(sign2);

    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-4.5, 4.5].forEach((sx) => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(7.7, 2.35, 0.1), trimMat);
      trim.position.set(sx, 6.8, -0.04);
      gantry.add(trim);
    });

    root.add(gantry);
  });

  // -------------------------------------------------------------
  // 6. WATANYA GAS STATION (محطة وقود وطنية حديثة)
  // -------------------------------------------------------------
  const gasStation = new THREE.Group();
  gasStation.name = 'Watanya_GasStation';
  gasStation.position.set(22, 0, -140);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.4,
    roughness: 0.4,
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 28), canopyMat);
  canopy.position.set(0, 7.5, 0);
  gasStation.add(canopy);

  const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6 });
  [-6, 6].forEach((cx) => {
    [-10, 10].forEach((cz) => {
      const pCol = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7.5, 12), colMat);
      pCol.position.set(cx, 3.75, cz);
      gasStation.add(pCol);
    });
  });

  [-4, 4].forEach((px) => {
    [-6, 6].forEach((pz) => {
      const pumpGeo = new THREE.BoxGeometry(1.2, 2.4, 2.0);
      const pumpMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.6,
      });
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(px, 1.2, pz);
      gasStation.add(pump);
    });
  });

  const storeGeo = new THREE.BoxGeometry(14, 5.5, 24);
  const storeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
  });
  const store = new THREE.Mesh(storeGeo, storeMat);
  store.position.set(15, 2.75, 0);
  gasStation.add(store);

  const glassMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const storeGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4.2), glassMat);
  storeGlass.position.set(7.9, 2.6, 0);
  gasStation.add(storeGlass);

  const totemGeo = new THREE.BoxGeometry(1.6, 9.5, 1.6);
  const totemMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.5,
  });
  const totem = new THREE.Mesh(totemGeo, totemMat);
  totem.position.set(-11, 4.75, -16);
  gasStation.add(totem);

  root.add(gasStation);

  // -------------------------------------------------------------
  // 7. SIDEWALK AHWA BALADI & PALM TREES (قهوة بلدي ونخيل مصري)
  // -------------------------------------------------------------
  const ahwaGroup = new THREE.Group();
  ahwaGroup.name = 'AhwaBaladi_EgyptianCafe';
  ahwaGroup.position.set(13.5, 0.1, 120);

  const palmZPositions = [-320, -210, -90, 30, 160, 280];
  palmZPositions.forEach((pz) => {
    [12.8, -12.4].forEach((px) => {
      const palm = new THREE.Group();
      palm.position.set(px, 0.1, pz);

      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.9,
      });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 7.5, 8), trunkMat);
      trunk.position.set(0, 3.75, 0);
      trunk.rotation.z = px > 0 ? 0.08 : -0.08;
      palm.add(trunk);

      const frondMat = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      for (let f = 0; f < 8; f++) {
        const ang = (f * Math.PI * 2) / 8;
        const frond = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 3.2), frondMat);
        frond.position.set(Math.cos(ang) * 1.2, 7.4, Math.sin(ang) * 1.2);
        frond.rotation.y = ang;
        frond.rotation.x = 0.45;
        palm.add(frond);
      }
      root.add(palm);
    });
  });

  const chairColors = [0x16a34a, 0xeab308, 0x2563eb, 0xdc2626];
  for (let r = 0; r < 4; r++) {
    const tableGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.8, 12);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(1.8, 0.4, r * 3.5 - 6);
    ahwaGroup.add(table);

    for (let c = 0; c < 4; c++) {
      const cAng = (c * Math.PI) / 2;
      const chairMat = new THREE.MeshStandardMaterial({
        color: chairColors[(r + c) % chairColors.length],
        roughness: 0.5,
      });
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55), chairMat);
      chair.position.set(
        1.8 + Math.cos(cAng) * 1.1,
        0.37,
        r * 3.5 - 6 + Math.sin(cAng) * 1.1
      );
      ahwaGroup.add(chair);
    }
  }

  const fanoosLight = new THREE.PointLight(0xf59e0b, 3.5, 14);
  fanoosLight.position.set(2.0, 3.0, 0);
  ahwaGroup.add(fanoosLight);

  root.add(ahwaGroup);

  // -------------------------------------------------------------
  // 8. HIGHWAY STREET LAMPS (Both sides of road every 35m)
  // -------------------------------------------------------------
  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3,
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  for (let z = -roadLength / 2; z <= roadLength / 2; z += 35) {
    [-9.8, 9.8].forEach((lampX) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(lampX, 0, z);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, 7.5, 10),
        lampPoleMat
      );
      pole.position.y = 3.75;
      lampGroup.add(pole);

      const dir = lampX > 0 ? -1 : 1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.09), lampPoleMat);
      arm.position.set(dir * 1.0, 7.4, 0);
      lampGroup.add(arm);

      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 12), lampGlowMat);
      bulb.position.set(dir * 2.1, 7.35, 0);
      lampGroup.add(bulb);

      const light = new THREE.SpotLight(0xfef08a, 4.0, 30, Math.PI / 3.5, 0.6);
      light.position.set(dir * 2.1, 7.3, 0);
      light.target.position.set(dir * 2.1, 0, 0);
      lampGroup.add(light);
      lampGroup.add(light.target);

      root.add(lampGroup);
    });
  }

  // -------------------------------------------------------------
  // 9. DYNAMIC CAIRO TRAFFIC SYSTEM (سيارات الشارع والميكروباص والتاكسي)
  // -------------------------------------------------------------
  const trafficVehicles: TrafficVehicle[] = [];

  function createTrafficCarMesh(type: TrafficVehicle['type']): {
    group: THREE.Group;
    wheels: THREE.Group[];
    headlights: THREE.SpotLight[];
    length: number;
    width: number;
  } {
    const carGroup = new THREE.Group();
    const wheels: THREE.Group[] = [];
    const headlights: THREE.SpotLight[] = [];

    const isTaxi = type === 'taxi';
    const isMicrobus = type === 'microbus';

    const carLength = isMicrobus ? 5.2 : 4.4;
    const carWidth = isMicrobus ? 1.95 : 1.82;
    const carHeight = isMicrobus ? 1.85 : 1.35;

    let bodyColor = 0xffffff;
    if (type === 'sedan_silver') bodyColor = 0xd1d5db;
    if (type === 'sedan_red') bodyColor = 0xb91c1c;
    if (type === 'sedan_blue') bodyColor = 0x1e3a8a;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: isMicrobus ? 0.3 : 0.75,
      roughness: isMicrobus ? 0.5 : 0.35,
    });
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth, carHeight * 0.55, carLength),
      bodyMat
    );
    mainBody.position.y = 0.55 + (carHeight * 0.55) / 2;
    carGroup.add(mainBody);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });

    if (isMicrobus) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.95, carHeight * 0.55, carLength * 0.88),
        bodyMat
      );
      cabin.position.set(0, 0.55 + carHeight * 0.55 + (carHeight * 0.55) / 2, -0.1);
      carGroup.add(cabin);

      [-carWidth / 2 - 0.01, carWidth / 2 + 0.01].forEach((wx) => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(carLength * 0.75, 0.6), glassMat);
        win.rotation.y = wx > 0 ? Math.PI / 2 : -Math.PI / 2;
        win.position.set(wx, 1.45, -0.1);
        carGroup.add(win);
      });
    } else {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.88, carHeight * 0.5, carLength * 0.52),
        glassMat
      );
      cabin.position.set(0, 0.55 + carHeight * 0.55 + (carHeight * 0.5) / 2, -0.2);
      carGroup.add(cabin);
    }

    if (isTaxi) {
      const blackStripeMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.8,
      });
      [-carWidth / 2 - 0.01, carWidth / 2 + 0.01].forEach((tx) => {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(carLength * 0.7, 0.28),
          blackStripeMat
        );
        stripe.rotation.y = tx > 0 ? Math.PI / 2 : -Math.PI / 2;
        stripe.position.set(tx, 0.85, -0.1);
        carGroup.add(stripe);
      });

      const taxiSignMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
      });
      const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.35), taxiSignMat);
      taxiSign.position.set(0, carHeight + 0.65, -0.2);
      carGroup.add(taxiSign);
    }

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-carWidth * 0.38, carWidth * 0.38].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), hlMat);
      hl.position.set(hx, 0.72, -carLength / 2 - 0.02);
      carGroup.add(hl);

      const spot = new THREE.SpotLight(0xfff8e7, 3.0, 35, Math.PI / 4, 0.5);
      spot.position.set(hx, 0.72, -carLength / 2 - 0.1);
      spot.target.position.set(hx, 0, -carLength / 2 - 20);
      carGroup.add(spot);
      carGroup.add(spot.target);
      headlights.push(spot);
    });

    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.9,
    });
    [-carWidth * 0.38, carWidth * 0.38].forEach((tx) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), tlMat);
      tl.position.set(tx, 0.75, carLength / 2 + 0.02);
      carGroup.add(tl);
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.9,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.8,
      roughness: 0.25,
    });

    const wheelRadius = isMicrobus ? 0.36 : 0.32;
    const wheelPositions = [
      { x: -carWidth / 2, z: -carLength * 0.32 },
      { x: carWidth / 2, z: -carLength * 0.32 },
      { x: -carWidth / 2, z: carLength * 0.32 },
      { x: carWidth / 2, z: carLength * 0.32 },
    ];

    wheelPositions.forEach((wp) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wp.x, wheelRadius, wp.z);

      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 16),
        tireMat
      );
      tire.rotation.z = Math.PI / 2;
      wGroup.add(tire);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, 0.23, 12),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      carGroup.add(wGroup);
      wheels.push(wGroup);
    });

    return {
      group: carGroup,
      wheels,
      headlights,
      length: carLength,
      width: carWidth,
    };
  }

  const trafficTypes: TrafficVehicle['type'][] = [
    'taxi',
    'microbus',
    'sedan_silver',
    'sedan_red',
    'taxi',
    'sedan_blue',
    'microbus',
    'sedan_silver',
  ];

  trafficTypes.forEach((type, idx) => {
    const meshData = createTrafficCarMesh(type);
    const laneIdx = idx % LANES.length;
    const laneX = LANES[laneIdx];
    const startZ = -380 + idx * 85 + (Math.random() * 20 - 10);
    const speedMs = 12 + (idx % 4) * 2.2;

    meshData.group.position.set(laneX, 0, startZ);
    root.add(meshData.group);

    trafficVehicles.push({
      id: idx,
      type,
      group: meshData.group,
      wheels: meshData.wheels,
      headlights: meshData.headlights,
      x: laneX,
      z: startZ,
      speedMs,
      laneIndex: laneIdx,
      targetLaneIndex: laneIdx,
      laneChangeProgress: 1.0,
      length: meshData.length,
      width: meshData.width,
    });
  });

  // -------------------------------------------------------------
  // 10. MISSION HOLOGRAPHIC CHECKPOINT RING
  // -------------------------------------------------------------
  const cpGroup = new THREE.Group();
  cpGroup.name = 'HolographicCheckpoint';

  const ringGeo = new THREE.TorusGeometry(3.6, 0.22, 16, 36);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    wireframe: true,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.2;
  cpGroup.add(ring);

  const pillarGeo = new THREE.CylinderGeometry(3.5, 3.5, 4.0, 24, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = 2.0;
  cpGroup.add(pillar);

  const cpLight = new THREE.PointLight(0x00f0ff, 6, 16);
  cpLight.position.y = 2.0;
  cpGroup.add(cpLight);

  cpGroup.position.set(0, 0, -50);
  root.add(cpGroup);

  return {
    group: root,
    checkpointMesh: ring,
    setCheckpointPosition: (x: number, z: number, visible: boolean) => {
      cpGroup.position.set(x, 0, z);
      cpGroup.visible = visible;
    },
    updateAnimation: (
      time: number,
      delta: number = 0.016,
      playerX: number = 0,
      playerZ: number = 0,
      playerSpeedKmh: number = 0
    ) => {
      ring.rotation.z = time * 1.5;
      ring.position.y = 1.2 + Math.sin(time * 3) * 0.3;
      pillar.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;

      feluccaMeshes.forEach((felucca, idx) => {
        felucca.position.y = -0.4 + Math.sin(time * 1.8 + idx * 1.2) * 0.08;
        felucca.rotation.z = Math.sin(time * 1.4 + idx) * 0.04;
      });

      beaconLight.intensity = 4.0 + Math.sin(time * 5.0) * 4.0;

      trafficVehicles.forEach((tv) => {
        tv.z -= tv.speedMs * delta;

        if (tv.laneChangeProgress < 1.0) {
          tv.laneChangeProgress = Math.min(1.0, tv.laneChangeProgress + delta * 1.4);
          const startX = LANES[tv.laneIndex];
          const targetX = LANES[tv.targetLaneIndex];
          tv.x = THREE.MathUtils.lerp(startX, targetX, tv.laneChangeProgress);
          if (tv.laneChangeProgress >= 1.0) {
            tv.laneIndex = tv.targetLaneIndex;
          }
        }

        const wheelRotDelta = (tv.speedMs * delta) / 0.34;
        tv.wheels.forEach((w) => {
          w.rotation.x += wheelRotDelta;
        });

        if (tv.z > playerZ + 140) {
          tv.z = playerZ - 260 - Math.random() * 120;
          tv.laneIndex = Math.floor(Math.random() * LANES.length);
          tv.targetLaneIndex = tv.laneIndex;
          tv.x = LANES[tv.laneIndex];
          tv.laneChangeProgress = 1.0;
          tv.speedMs = 12 + Math.random() * 8;
        } else if (tv.z < playerZ - 380) {
          tv.z = playerZ + 120 + Math.random() * 60;
          tv.laneIndex = Math.floor(Math.random() * LANES.length);
          tv.targetLaneIndex = tv.laneIndex;
          tv.x = LANES[tv.laneIndex];
          tv.laneChangeProgress = 1.0;
        }

        tv.group.position.set(tv.x, 0, tv.z);
      });
    },

    checkTrafficCollision: (playerX: number, playerZ: number, playerRadius: number = 1.6): boolean => {
      for (let i = 0; i < trafficVehicles.length; i++) {
        const tv = trafficVehicles[i];
        const dx = Math.abs(tv.x - playerX);
        const dz = Math.abs(tv.z - playerZ);
        if (dx < (tv.width / 2 + playerRadius * 0.6) && dz < (tv.length / 2 + playerRadius * 0.9)) {
          return true;
        }
      }
      return false;
    },

    onPlayerHorn: (playerX: number, playerZ: number) => {
      trafficVehicles.forEach((tv) => {
        const dz = playerZ - tv.z;
        const dx = Math.abs(tv.x - playerX);
        if (dz > 0 && dz < 55 && dx < 2.5) {
          if (tv.laneIndex < LANES.length - 1) {
            tv.targetLaneIndex = tv.laneIndex + 1;
            tv.laneChangeProgress = 0.0;
          }
        }
      });
    },
  };
}
