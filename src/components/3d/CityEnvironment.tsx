import * as THREE from 'three';

export interface CityEnvironment {
  group: THREE.Group;
  checkpointMesh: THREE.Mesh;
  setCheckpointPosition: (x: number, z: number, visible: boolean) => void;
  updateAnimation: (time: number) => void;
}

export function createCityEnvironment(): CityEnvironment {
  const root = new THREE.Group();
  root.name = 'CityEnvironment_Root';

  // Ground plane - Asphalt road
  const roadGeo = new THREE.PlaneGeometry(80, 800);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.85,
    metalness: 0.1,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  root.add(road);

  // Center Road Markings: Double Solid Yellow Lines
  [-0.15, 0.15].forEach((offset) => {
    const lineGeo = new THREE.PlaneGeometry(0.12, 800);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(offset, 0.01, 0);
    root.add(line);
  });

  // White Dashed Lane Dividers
  [-5.5, 5.5].forEach((laneX) => {
    for (let z = -380; z < 380; z += 12) {
      const dashGeo = new THREE.PlaneGeometry(0.18, 5.5);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(laneX, 0.01, z);
      root.add(dash);
    }
  });

  // Concrete Curbs & Sidewalks
  [-11.5, 11.5].forEach((curbX) => {
    // Curb stone
    const curbGeo = new THREE.BoxGeometry(0.4, 0.2, 800);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(curbX, 0.1, 0);
    root.add(curb);

    // Sidewalk walkway
    const sideGeo = new THREE.BoxGeometry(7, 0.2, 800);
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
    });
    const sidewalk = new THREE.Mesh(sideGeo, sideMat);
    sidewalk.position.set(curbX > 0 ? curbX + 3.7 : curbX - 3.7, 0.1, 0);
    root.add(sidewalk);
  });

  // Street Lamps on both sides
  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3,
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  for (let z = -360; z <= 360; z += 40) {
    [-12.5, 12.5].forEach((lampX) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(lampX, 0, z);

      // Vertical pole
      const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 6.5, 10);
      const pole = new THREE.Mesh(poleGeo, lampPoleMat);
      pole.position.y = 3.25;
      lampGroup.add(pole);

      // Horizontal arm pointing towards the road
      const armGeo = new THREE.BoxGeometry(2.2, 0.08, 0.08);
      const arm = new THREE.Mesh(armGeo, lampPoleMat);
      const dir = lampX > 0 ? -1 : 1;
      arm.position.set(dir * 0.9, 6.4, 0);
      lampGroup.add(arm);

      // Light fixture bulb
      const bulbGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 12);
      const bulb = new THREE.Mesh(bulbGeo, lampGlowMat);
      bulb.position.set(dir * 1.8, 6.35, 0);
      lampGroup.add(bulb);

      // Spotlight down on the asphalt
      const light = new THREE.SpotLight(0xfef08a, 4.5, 26, Math.PI / 3.8, 0.6);
      light.position.set(dir * 1.8, 6.3, 0);
      light.target.position.set(dir * 1.8, 0, 0);
      lampGroup.add(light);
      lampGroup.add(light.target);

      root.add(lampGroup);
    });
  }

  // City Skyline / Modern Urban Buildings
  const buildingColors = [0x1e293b, 0x0f172a, 0x111827, 0x1c1917, 0x18181b];
  const windowLitMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const windowDarkMat = new THREE.MeshBasicMaterial({ color: 0x334155 });

  for (let z = -370; z <= 370; z += 35) {
    [-28, 28].forEach((bldgX, idx) => {
      const height = 18 + Math.abs((z * 13) % 45);
      const width = 18 + Math.abs((z * 7) % 12);
      const depth = 26;

      const bldgGeo = new THREE.BoxGeometry(width, height, depth);
      const bColor = buildingColors[Math.abs(Math.floor(z + idx)) % buildingColors.length];
      const bldgMat = new THREE.MeshStandardMaterial({
        color: bColor,
        roughness: 0.7,
      });

      const bldg = new THREE.Mesh(bldgGeo, bldgMat);
      bldg.position.set(bldgX > 0 ? bldgX + width / 2 : bldgX - width / 2, height / 2, z);
      root.add(bldg);

      // Glowing office windows pattern on facade
      const windowPlaneGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.75);
      const facade = new THREE.Mesh(
        windowPlaneGeo,
        Math.random() > 0.3 ? windowLitMat : windowDarkMat
      );
      facade.rotation.y = bldgX > 0 ? -Math.PI / 2 : Math.PI / 2;
      facade.position.set(
        bldgX > 0 ? bldgX : bldgX,
        height / 2,
        z
      );
      root.add(facade);
    });
  }

  // Mission Holographic Checkpoint Ring / Pillar
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

  // Checkpoint Light
  const cpLight = new THREE.PointLight(0x00f0ff, 6, 15);
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
    updateAnimation: (time: number) => {
      ring.rotation.z = time * 1.5;
      ring.position.y = 1.2 + Math.sin(time * 3) * 0.3;
      pillar.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;
    },
  };
}
