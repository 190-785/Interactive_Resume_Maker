// src/js/main.js
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import Carriage from './assets/carriage.js';

// ───── Constants ───────────────────────────────────────────────────────────────
const PATH_POINTS = 100;
const TREE_COUNT = 50;
const FOREST_RADIUS = 80;
const SCROLL_PROXIMITY_THRESHOLD = 3;
const MAX_DELTA = 0.05; // clamp frame delta to 50ms

// ───── Scratch Objects ─────────────────────────────────────────────────────────
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q  = new THREE.Quaternion();
const _m  = new THREE.Matrix4();

// ───── Camera Settings ─────────────────────────────────────────────────────────
const cameraSettings = {
  distance: 5,
  height: 2,
  smoothing: 0.1,
  mode: 'chase',
  fovTransitionSpeed: 1,
  defaultFOV: 75,
  movingFOV: 80
};

// ───── Scene, Camera, Renderer ─────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  cameraSettings.defaultFOV,
  window.innerWidth / window.innerHeight,
  0.1, 1000
);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    context: document.createElement('canvas').getContext('webgl2')
  });
} catch (e) {
  console.warn('WebGL2 not supported, falling back to WebGL1');
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    context: document.createElement('canvas').getContext('webgl')
  });
}
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ───── Fog & Background ────────────────────────────────────────────────────────
scene.fog = new THREE.FogExp2(0x88aa88, 0.01);
scene.background = new THREE.Color(0x8ab6c1);

// ───── Lights ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xb0dae7, 0.6);
const sun = new THREE.DirectionalLight(0xfff0d9, 1.5);
sun.position.set(5, 10, 5);
sun.castShadow = true;
// Lower shadow resolution + tighten frustum
sun.shadow.mapSize.width = 512;
sun.shadow.mapSize.height = 512;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(ambient, sun);

const hemiLight = new THREE.HemisphereLight(0x88cc88, 0x224422, 0.8);
scene.add(hemiLight);

const pointLight = new THREE.PointLight(0xffeedd, 0.8);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);

const spotLight = new THREE.SpotLight(0xffffcc, 0.7);
spotLight.position.set(-5, 10, 5);
scene.add(spotLight);

// ───── Shared TextureLoader ───────────────────────────────────────────────────
const loader = new THREE.TextureLoader();

// ───── Ground ─────────────────────────────────────────────────────────────────
function createGround() {
  const color     = loader.load('/textures/grass/Grass001_1K-JPG_Color.jpg');
  const normal    = loader.load('/textures/grass/Grass001_1K-JPG_NormalGL.jpg');
  const roughness = loader.load('/textures/grass/Grass001_1K-JPG_Roughness.jpg');
  const ao        = loader.load('/textures/grass/Grass001_1K-JPG_AmbientOcclusion.jpg');

  [color, normal, roughness, ao].forEach(tex => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 30);
  });

  const geo = new THREE.PlaneGeometry(200, 200);
  const mat = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: normal,
    roughnessMap: roughness,
    aoMap: ao,
    color: 0x338833
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

// ───── Path ───────────────────────────────────────────────────────────────────
function createPath() {
  const points = [];
  for (let i = 0; i < PATH_POINTS; i++) {
    const t = i / (PATH_POINTS - 1);
    const x = 20 * Math.sin(t * Math.PI * 2);
    const z = -50 + t * 100;
    points.push(new THREE.Vector3(x, 0.05, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 50, 2, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return curve;
}

// ───── Forest (Instanced) ─────────────────────────────────────────────────────
function createForest() {
  // Trunks
  
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1, 1, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
  trunks.castShadow = trunks.receiveShadow = true;

  // Leaves
  const leafGeo = new THREE.ConeGeometry(1, 1.5, 8);
  const leafMat = new THREE.MeshStandardMaterial({
    map: loader.load('/textures/leaves/LeafSet015_1K-JPG_Color.jpg'),
    alphaMap: loader.load('/textures/leaves/LeafSet015_1K-JPG_Opacity.jpg'),
    transparent: true,
    roughness: 1.0
  });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, TREE_COUNT);
  leaves.castShadow = leaves.receiveShadow = true;

  let idx = 0;
  for (let i = 0; i < TREE_COUNT * 2 && idx < TREE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * FOREST_RADIUS;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 5 && Math.abs(z) < 50) continue;

    const height = 1 + Math.random() * 2;
    const scale = 0.7 + Math.random() * 0.8;

    // Trunk matrix
    _v1.set(x, height / 2, z);
    _q.identity();
    _v2.set(0.7, height, 0.7);
    _m.compose(_v1, _q, _v2);
    trunks.setMatrixAt(idx, _m);

    // Leaf matrix
    _v1.set(x, height + scale * 0.75, z);
    _v2.set(scale, scale, scale);
    _m.compose(_v1, _q, _v2);
    leaves.setMatrixAt(idx, _m);

    idx++;
  }
  // AFTER (no more forest shadows)
trunks.castShadow    = false;
trunks.receiveShadow = false;
leaves.castShadow    = false;
leaves.receiveShadow = false;

  trunks.count = leaves.count = idx;
  scene.add(trunks, leaves);
}

// ───── UI Manager & Scroll Proximity ───────────────────────────────────────────
const scrolls = [];
class UIManager {
  constructor() {
    this.panels = {
      Skills:     document.getElementById('skills-panel'),
      Experience: document.getElementById('experience-panel'),
      Education:  document.getElementById('education-panel')
    };
    this.shown = new Set();

    for (let key of Object.keys(this.panels)) {
      const panel = this.panels[key];
      const id = panel.id.split('-')[0]; // "skills", etc.
      document.getElementById(`close-${id}`)
        .addEventListener('click', () => {
          panel.style.display = 'none';
          this.shown.delete(key);
        });
    }
  }
  show(title) {
    const panel = this.panels[title];
    if (panel && !this.shown.has(title)) {
      panel.style.display = 'block';
      this.shown.add(title);
    }
  }
}

function createResumeContent(pathCurve) {
  const sections = [
    { title: 'Skills',     pos: -0.8, color: 0x6495ED },
    { title: 'Experience', pos: -0.5, color: 0x9ACD32 },
    { title: 'Education',  pos: -0.2, color: 0xFFA500 }
  ];
  sections.forEach(s => {
    const t = THREE.MathUtils.clamp(s.pos + 0.5, 0, 1);
    const pt = pathCurve.getPointAt(t);
    const tg = pathCurve.getTangentAt(t);
    createScroll(pt, tg, s.title, s.color);
  });
}

function createScroll(position, direction, title, color) {
  const offset = new THREE.Vector3(-direction.z, 0, direction.x)
    .normalize()
    .multiplyScalar(3);
  const scrollPos = position.clone().add(offset);

  // Cylinder base
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xE8DCCA, roughness: 0.9 });
  const scrollMesh = new THREE.Mesh(geo, mat);
  scrollMesh.position.copy(scrollPos);
  scrollMesh.castShadow = scrollMesh.receiveShadow = true;
  scene.add(scrollMesh);

  // Colored card
  const cardGeo = new THREE.PlaneGeometry(1.6, 0.6);
  const cardMat = new THREE.MeshStandardMaterial({
    color, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.position.set(scrollPos.x, scrollPos.y + 1.2, scrollPos.z);
  card.lookAt(position.x, card.position.y, position.z);
  card.castShadow = card.receiveShadow = true;
  scene.add(card);

  scrolls.push({ position: scrollPos.clone(), title });
}

function checkResumeProximity(ui, carriage) {
  const pos = carriage.group.position;
  scrolls.forEach(s => {
    if (s.position.distanceTo(pos) < SCROLL_PROXIMITY_THRESHOLD) {
      ui.show(s.title);
    }
  });
}

// ───── On‑Screen Controls Overlay ──────────────────────────────────────────────
function createUserInterface() {
  const uiContainer = document.createElement('div');
  Object.assign(uiContainer.style, {
    position: 'absolute',
    bottom: '20px',
    left:   '20px',
    color:  'white',
    padding: '10px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '5px',
    fontFamily: 'Arial, sans-serif'
  });
  uiContainer.innerHTML = `
    <h3 style="margin:0 0 10px 0">Interactive Resume - Controls:</h3>
    <div>W / ↑ - Accelerate</div>
    <div>S / ↓ - Brake/Reverse</div>
    <div>A / ← - Steer Left</div>
    <div>D / → - Steer Right</div>
    <div>C - Change Camera Mode</div>
    <div>Approach the scrolls to view resume sections!</div>
  `;
  document.body.appendChild(uiContainer);
}

// ───── Main Setup ───────────────────────────────────────────────────────────────
createGround();
const pathCurve = createPath();
createForest();
createUserInterface();

const ui = new UIManager();
const carriage = new Carriage();
carriage.group.position.set(0, 0, -40);
carriage.addToScene(scene);
createResumeContent(pathCurve);

camera.position.set(0, 2, -35);
camera.lookAt(carriage.group.position);

// ───── Handle Resize (Debounced) ──────────────────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 200);
});

// ───── Input Handling ──────────────────────────────────────────────────────────
const keysPressed = {};
window.addEventListener('keydown', e => keysPressed[e.key.toLowerCase()] = true);
window.addEventListener('keyup',   e => keysPressed[e.key.toLowerCase()] = false);

let previousCKey = false;
let orbitAngle = 0;

function processControls(delta) {
  // Steer
  let steer = 0;
  if (keysPressed['a']||keysPressed['arrowleft'])  steer = -1;
  if (keysPressed['d']||keysPressed['arrowright']) steer =  1;
  carriage.steer(steer);

  if (steer === 0) carriage.centerSteering(delta);

  // Accelerate
  let accel = 0;
  if (keysPressed['w']||keysPressed['arrowup'])    accel = 10;
  if (keysPressed['s']||keysPressed['arrowdown'])  accel = -10;
  carriage.accelerate(accel, delta);
  carriage.applyFriction(delta);

  // Camera mode switch
  if (keysPressed['c'] && !previousCKey) {
    const modes = ['chase','orbit','free'];
    const idx = modes.indexOf(cameraSettings.mode);
    cameraSettings.mode = modes[(idx + 1) % modes.length];
    previousCKey = true;
  } else if (!keysPressed['c']) {
    previousCKey = false;
  }
}

function updateCamera(delta) {
  delta = Math.min(delta, MAX_DELTA);

  // copy carriage position once
  const carPos = carriage.group.position;
  _v3.copy(carPos);

  // compute forward dir without new Vector3()
  _v4.set(
    Math.sin(carriage.facingAngle),
    0,
    Math.cos(carriage.facingAngle)
  );

  let target = _v3;

  if (cameraSettings.mode === 'chase') {
    // chase: back + up
    _v3.add(_v4.multiplyScalar(-cameraSettings.distance));
    _v3.y += cameraSettings.height;
    target = _v3;
  } else if (cameraSettings.mode === 'orbit') {
    orbitAngle += delta * 0.5;
    _v3.x += Math.sin(orbitAngle) * cameraSettings.distance;
    _v3.y  = cameraSettings.height + carPos.y;
    _v3.z += Math.cos(orbitAngle) * cameraSettings.distance;
    target = _v3;
  } else {
    // free mode: do nothing
    return;
  }

  camera.position.lerp(target, cameraSettings.smoothing);
  camera.lookAt(_v3.copy(carPos).addScalar(0.5));

  // FOV tweak
  const speedFactor = Math.abs(carriage.velocity) / 10;
  const desiredFOV = THREE.MathUtils.lerp(
    cameraSettings.defaultFOV,
    cameraSettings.movingFOV,
    speedFactor
  );
  camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFOV, cameraSettings.fovTransitionSpeed * delta);
  camera.updateProjectionMatrix();
}


function animate() {
  requestAnimationFrame(animate);
  const delta = carriage.clock.getDelta();
  processControls(delta);
  carriage.update(delta);
  updateCamera(delta);
  checkResumeProximity(ui, carriage);
  renderer.render(scene, camera);
}
animate();
