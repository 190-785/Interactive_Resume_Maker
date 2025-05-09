// src/js/main.js
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'; // Added MTLLoader
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// GUI import is present but GUI is not used in the current script. Can be removed if not planned.
// import { GUI } from 'dat.gui';

// ───── Constants ───────────────────────────────────────────────────────────────
const PATH_LENGTH = 100;
const ROAD_WIDTH = 6;
const TREE_SPACING_MODULO = 28; // Increased for more spacing
const LOAD_TIMEOUT = 60000; // 60 seconds
const SCROLL_PROXIMITY_THRESHOLD = 4; // Slightly increased
const MAX_DELTA = 0.05;

// Ground and Path Y positions
const GROUND_Y = 0;
const ROAD_Y = 0.01; // Road slightly above ground
const PATH_ELEMENT_Y = 0.02; // Trees, scrolls, car on this level, slightly above road

// ───── Scratch Objects ─────────────────────────────────────────────────────────
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q  = new THREE.Quaternion();
const _m  = new THREE.Matrix4();
const Y_AXIS = new THREE.Vector3(0, 1, 0); // For rotations

// ───── Camera Settings ─────────────────────────────────────────────────────────
const cameraSettings = {
  distance: 22, // Increased distance for farther view
  height: 7,    // Increased height
  smoothing: 0.04, // Adjusted smoothing
  defaultFOV: 60, // Slightly reduced FOV can make distance feel greater
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
    powerPreference: 'high-performance',
    alpha: false
  });
} catch (e) {
  console.error('WebGL initialization failed:', e);
  const errorMsgElement = document.getElementById('error-message');
  if (errorMsgElement) {
    errorMsgElement.textContent = `WebGL Error: ${e.message}`;
    errorMsgElement.style.display = 'block';
  }
  throw e;
}
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ───── Error Handling ───────────────────────────────────────────────────────────
const errorMessage = document.getElementById('error-message');
window.addEventListener('error', (event) => {
  console.error('Error occurred:', event.error || event.message); // Handle both error object and message string
  if (errorMessage) {
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Error: ' + (event.error ? event.error.message : event.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  if (errorMessage) {
    errorMessage.style.display = 'block';
    let msg = 'Async Error: An unknown error occurred.';
    if (event.reason instanceof Error) {
        msg = `Async Error: ${event.reason.message}`;
    } else if (typeof event.reason === 'string') {
        msg = `Async Error: ${event.reason}`;
    }
    errorMessage.textContent = msg;
  }
});

// Show loading indicator
const loadingContainer = document.createElement('div');
loadingContainer.style.position = 'fixed';
loadingContainer.style.top = '0';
loadingContainer.style.left = '0';
loadingContainer.style.width = '100%';
loadingContainer.style.height = '100%';
loadingContainer.style.backgroundColor = '#111';
loadingContainer.style.color = 'white';
loadingContainer.style.display = 'flex';
loadingContainer.style.flexDirection = 'column';
loadingContainer.style.justifyContent = 'center';
loadingContainer.style.alignItems = 'center';
loadingContainer.style.zIndex = '1000';
loadingContainer.style.transition = 'opacity 1s ease';
loadingContainer.innerHTML = `
  <div style="font-size: 2em; margin-bottom: 20px;">Loading Interactive Forest Resume</div>
  <div style="width: 50%; height: 20px; border: 2px solid white; border-radius: 10px; overflow: hidden;">
    <div id="loading-progress" style="height: 100%; width: 0%; background-color: #4CAF50; transition: width 0.3s ease;"></div>
  </div>
`;
document.body.appendChild(loadingContainer);

// ───── Fog & Background ────────────────────────────────────────────────────────
scene.background = new THREE.Color(0x8ab6c1);

// ───── Lights ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 1.8); // Slightly reduced ambient
const sun = new THREE.DirectionalLight(0xffffff, 2.5); // Slightly reduced sun
sun.position.set(25, 30, 20); // Adjusted sun position for potentially better angles
sun.castShadow = true;
sun.shadow.mapSize.width = 1024; // Increased shadow map size for better quality
sun.shadow.mapSize.height = 1024;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100; // Increased far plane for shadows
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(ambient, sun);

const hemiLight = new THREE.HemisphereLight(0x88cc88, 0x224422, 0.7);
scene.add(hemiLight);

// ───── Global Variables for Loaded Assets ───────────────────────────────────────
let helvetikerFont = null;

// ───── Resource Manager ─────────────────────────────────────────────────────────
const loadingManager = new THREE.LoadingManager(
  () => {
    console.log('All critical assets loaded!');
    clearTimeout(timeoutHandle);
    if (!window.initialized) {
      window.initialized = true;
      loadingContainer.style.opacity = '0';
      setTimeout(() => {
        loadingContainer.style.display = 'none';
        init();
      }, 1000);
    }
  },
  (url, itemsLoaded, itemsTotal) => {
    console.log(`Loading: ${itemsLoaded}/${itemsTotal} ${url}`);
    const progressElement = document.getElementById('loading-progress');
    if (progressElement) {
        progressElement.style.width = `${(itemsLoaded/itemsTotal)*100}%`;
    }
  },
  (url) => {
    console.error(`Error loading via manager: ${url}`);
    if (errorMessage) {
        errorMessage.textContent = `Failed to load: ${url}`;
        errorMessage.style.display = 'block';
    }
  }
);

let timeoutHandle = setTimeout(() => {
  if (errorMessage) {
    errorMessage.textContent = 'Loading timeout - Check console for details';
    errorMessage.style.display = 'block';
  }
  console.error('Loading timeout. Check network tab for stalled resources.');
}, LOAD_TIMEOUT);


const appTextureLoader = new THREE.TextureLoader(loadingManager);

// ───── Fallback Textures ───────────────────────────────────────────────────────
// createFallbackTexture function remains the same

function createFallbackTexture(color, resolution = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, resolution, resolution);
  
  if (color !== '#FFFFFF') {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * resolution;
      const y = Math.random() * resolution;
      const size = 1 + Math.random() * 2;
      ctx.fillRect(x, y, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true; // Ensure canvas is uploaded
  return texture;
}

const fallbackTextures = {
  color: createFallbackTexture('#4A7023'), // Dark green
  normal: createFallbackTexture('#8080FF'), // Blueish for normal map
  roughness: createFallbackTexture('#888888'), // Grey
  ao: createFallbackTexture('#FFFFFF'), // White
  opacity: createFallbackTexture('#FFFFFF') // White
};


// ───── Texture Loading Helper ─────────────────────────────────────────────────
function loadTexture(path, fallback, repeat = 1) {
  const texture = appTextureLoader.load( // Use the manager-associated loader
    path,
    () => console.log('Texture loaded:', path),
    undefined, // onProgress not needed here, manager handles aggregate
    (err) => { // onError
      console.error('Error loading texture:', path, err);
      // The texture object will be a dummy. We need to replace its image.
      if (texture && fallback && fallback.image) {
        texture.image = fallback.image;
        texture.needsUpdate = true;
        console.log(`Applied fallback for texture: ${path}`);
      } else {
        console.error(`Fallback or texture object not available for ${path}`);
      }
    }
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

// ───── Ground ─────────────────────────────────────────────────────────────────
function createGround() {
  const color = loadTexture('textures/Grass001_1K-JPG_Color.jpg', fallbackTextures.color, 40); // Increased repeat for larger ground
  const normal = loadTexture('textures/Grass001_1K-JPG_NormalGL.jpg', fallbackTextures.normal, 40);
  const roughness = loadTexture('textures/Grass001_1K-JPG_Roughness.jpg', fallbackTextures.roughness, 40);
  const ao = loadTexture('textures/Grass001_1K-JPG_AmbientOcclusion.jpg', fallbackTextures.ao, 40);

  const geo = new THREE.PlaneGeometry(300, 300); // Larger ground plane
  const mat = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: normal,
    roughnessMap: roughness,
    aoMap: ao,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.y = GROUND_Y;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

// ───── Path ───────────────────────────────────────────────────────────────────
function createPath() {
  const points = [];
  for (let i = 0; i <= PATH_LENGTH; i++) {
    const z = -PATH_LENGTH / 2 + i;
    points.push(new THREE.Vector3(0, PATH_ELEMENT_Y, z)); // Path elements elevated
  }
  return new THREE.CatmullRomCurve3(points);
}

// ───── UI Manager & Scroll Proximity ───────────────────────────────────────────
const scrolls = [];
class UIManager {
  constructor() {
    this.panels = {
      About:      document.getElementById('about-panel'),
      Skills:     document.getElementById('skills-panel'),
      Experience: document.getElementById('experience-panel'),
      Education:  document.getElementById('education-panel'),
      Projects:   document.getElementById('projects-panel')
    };
    this.shown = new Set();

    for (let key of Object.keys(this.panels)) {
      const panel = this.panels[key];
      if (!panel) {
        console.warn(`UI panel not found for: ${key}`);
        continue;
      }
      const id = panel.id.split('-')[0];
      const closeButton = document.getElementById(`close-${id}`);
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.hide(key); // Use hide method
        });
      }
    }
  }
  
  show(title) {
    const panel = this.panels[title];
    if (panel && !this.shown.has(title)) {
      panel.style.display = 'block';
      this.shown.add(title);
    }
  }

  hide(title) {
    const panel = this.panels[title];
    if (panel && this.shown.has(title)) {
        panel.style.display = 'none';
        this.shown.delete(title);
    }
  }

  isOpen(title) {
    return this.shown.has(title);
  }
}

function createResumeContent(pathCurveInstance, uiInstance) {
  const sections = [
    { title: 'About',      pos: -0.9, color: 0xFF6347 }, // Tomato
    { title: 'Skills',     pos: -0.7, color: 0x6495ED }, // CornflowerBlue
    { title: 'Experience', pos: -0.4, color: 0x9ACD32 }, // YellowGreen
    { title: 'Projects',   pos: -0.1, color: 0xDA70D6 }, // Orchid
    { title: 'Education',  pos:  0.2, color: 0xFFA500 }  // Orange
  ];
  
  sections.forEach(s => {
    const t = THREE.MathUtils.clamp(s.pos + 0.5, 0.05, 0.95); // Avoid exact ends for tangent
    const pt = pathCurveInstance.getPointAt(t);
    const tg = pathCurveInstance.getTangentAt(t);
    createScroll(pt, tg, s.title, s.color, uiInstance);
  });
}


function createScroll(position, direction, title, color, ui) {
  // Randomize scroll placement slightly more
  const sideOffsetMagnitude = ROAD_WIDTH / 2 + 2 + Math.random() * 3; // 2-5 units from road edge
  const zOffsetMagnitude = (Math.random() - 0.5) * 4; // +/- 2 units along path direction

  const randomSide = Math.random() < 0.5 ? 1 : -1; // Place on left or right

  _v2.set(-direction.z * randomSide, 0, direction.x * randomSide).normalize().multiplyScalar(sideOffsetMagnitude); // Perpendicular offset
  const scrollPos = _v1.copy(position).add(_v2);
  scrollPos.z += zOffsetMagnitude; // Add slight Z variation
  scrollPos.y = PATH_ELEMENT_Y; // Ensure consistent Y for base

  const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16); // Slightly smaller scroll
  const mat = new THREE.MeshStandardMaterial({ color: 0xE8DCCA, roughness: 0.8, metalness: 0.2 });
  const scrollMesh = new THREE.Mesh(geo, mat);
  scrollMesh.position.copy(scrollPos);
  scrollMesh.position.y += 0.75; // Base of scroll on PATH_ELEMENT_Y + half height
  scrollMesh.castShadow = scrollMesh.receiveShadow = true;
  scene.add(scrollMesh);

  const cardGeo = new THREE.PlaneGeometry(1.5, 0.5);
  const cardMat = new THREE.MeshStandardMaterial({
    color, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1,
    emissive: color, // Make card glow
    emissiveIntensity: 0.5 // Adjust intensity of glow
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.position.set(0, 1.0, 0); // Position relative to scrollMesh top center
  scrollMesh.add(card); // Add card as child of scroll for easier compound rotation/positioning
  
  // Make card face towards the path's center line (approx.)
  // Calculate lookAt point on the path, at card's height
  _v3.set(position.x, scrollMesh.position.y + card.position.y, position.z);
  card.lookAt(_v3); // Card itself looks at path, scrollMesh determines its base position/orientation
  card.castShadow = true; // Card can cast a shadow
  // scene.add(card); // No longer add directly to scene

  if (helvetikerFont) {
    const textGeo = new TextGeometry(title, {
      font: helvetikerFont, size: 0.18, height: 0.02, curveSegments: 3, bevelEnabled: false
    });
    textGeo.computeBoundingBox();
    const centerOffset = -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
    const textMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.position.set(centerOffset, -0.05, 0.03); // Centered on card, slightly in front
    card.add(textMesh);
  } else {
    console.error("Helvetiker font not preloaded for scroll title:", title);
  }
  scrolls.push({ mesh: scrollMesh, position: scrollMesh.position, title, ui });
}


function checkResumeProximity(carObject) {
  if (!carObject || !uiManager) return;
  const carPos = carObject.position; // Assuming carObject is the car mesh itself
  scrolls.forEach(s => {
    const distanceToScroll = s.position.distanceTo(carPos);
    if (distanceToScroll < SCROLL_PROXIMITY_THRESHOLD) {
      s.ui.show(s.title);
    } else {
      if (s.ui.isOpen(s.title)) {
        s.ui.hide(s.title);
      }
    }
  });
}

// ───── On‑Screen Controls Overlay ──────────────────────────────────────────────
function createUserInterface() {
  const uiContainer = document.createElement('div');
  Object.assign(uiContainer.style, {
    position: 'absolute', bottom: '20px', left:   '20px', color:  'white',
    padding: '10px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '5px',
    fontFamily: 'Arial, sans-serif', zIndex: '100', fontSize: '14px'
  });
  uiContainer.innerHTML = `
    <h3 style="margin:0 0 10px 0; font-size: 16px;">Interactive Resume</h3>
    <div><b>W / &uarr;</b> : Accelerate</div>
    <div><b>S / &darr;</b> : Brake/Reverse</div>
    <div><b>A / &larr;</b> : Steer Left</div>
    <div><b>D / &rarr;</b> : Steer Right</div>
    <div><b>Mouse Orbit/Scroll</b> : Camera Control</div>
    <div style="margin-top: 8px;">Approach scrolls to view resume sections.</div>
  `;
  document.body.appendChild(uiContainer);
}

// ───── Main Setup ───────────────────────────────────────────────────────────────
let pathCurve = createPath();
let car = null;
let trees = [];
let keysPressed = {};
let controls;
let uiManager;

const VEHICLE_PHYSICS = {
  maxSpeed: 22, acceleration: 45, brakeForce: 60, // Increased brake force
  steeringSpeed: 1.6, steeringReturn: 3.2, maxSteering: Math.PI / 3.8,
  wheelBase: 2.8, friction: 5 // Increased friction
};

let velocity = 0;
let steeringAngle = 0;
let engineForce = 0;

const clock = new THREE.Clock();

createGround(); // Create ground early, textures will load

async function loadAssets() {
  const objLoader = new OBJLoader(loadingManager);
  const fbxLoader = new FBXLoader(loadingManager);
  const mtlLoader = new MTLLoader(loadingManager);
  const appFontLoader = new FontLoader(loadingManager);

  const carPath = 'assets/car/Humvee.fbx';
  const treeMtlPath = 'assets/low_poly_tree/Lowpoly_tree_sample.mtl';
  const treeObjPath = 'assets/low_poly_tree/Lowpoly_tree_sample.obj';
  const fontPath = 'fonts/helvetiker_regular.typeface.json';

  // Note on FBXLoader warning: "invalid (negative) material indices" for Humvee.fbx
  // This is an issue within the FBX file itself and may cause parts of the car to use default materials.
  // This cannot be fixed in JS code without modifying the FBX or complex runtime material overrides.
  const carPromise = fbxLoader.loadAsync(carPath);
  const treeMaterialsPromise = mtlLoader.loadAsync(treeMtlPath);
  const fontPromise = appFontLoader.loadAsync(fontPath);
  
  // Await critical assets
  const [loadedCar, materials, loadedFont] = await Promise.all([carPromise, treeMaterialsPromise, fontPromise]);

  // Process Car
  loadedCar.scale.set(0.02, 0.02, 0.02);
  loadedCar.position.set(0, PATH_ELEMENT_Y, pathCurve.getPointAt(0.5).z); // Start car on path Y
  loadedCar.traverse(child => {
    if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
    }
  });

  // Process Tree Model
  materials.preload();
  objLoader.setMaterials(materials);
  const treeModel = await objLoader.loadAsync(treeObjPath); // OBJ uses preloaded materials
  treeModel.traverse(child => {
      if (child.isMesh) {
          child.castShadow = true;
      }
  });
  
  return { loadedCar, treeModel, loadedFont };
}


function placeTreesAlongPath(treeModel) {
  const placedTrees = [];
  // Get fewer points but space them more with modulo, or more points for finer control with getPointAt(t)
  const numPointsForTreeLine = PATH_LENGTH; // Number of points to check along the path
  
  for (let i = 0; i < numPointsForTreeLine; i++) {
    if (i % TREE_SPACING_MODULO === Math.floor(Math.random() * (TREE_SPACING_MODULO/4))) { // Add jitter to modulo
      const t = i / numPointsForTreeLine;
      const point = pathCurve.getPointAt(t);
      // const tangent = pathCurve.getTangentAt(t); // Could use for orientation if needed

      const baseScale = 0.7 + Math.random() * 0.5;
      const randomXOffset = ROAD_WIDTH / 2 + 4 + Math.random() * 12; // 4-16 units from road edge
      const randomZShift = (Math.random() - 0.5) * 8; // +/- 4 units along Z from the path point's Z

      // Left side
      const leftTree = treeModel.clone();
      leftTree.position.set(point.x + randomXOffset, PATH_ELEMENT_Y, point.z + randomZShift);
      leftTree.rotation.y = Math.random() * Math.PI * 2;
      leftTree.scale.set(baseScale, baseScale + Math.random() * 0.4, baseScale);
      scene.add(leftTree);
      placedTrees.push(leftTree);

      // Right side (ensure it doesn't place on same exact random Z shift)
      const rightTree = treeModel.clone();
      rightTree.position.set(point.x - randomXOffset, PATH_ELEMENT_Y, point.z - randomZShift + (Math.random()-0.5)*2); // Slightly different Z for right
      rightTree.rotation.y = Math.random() * Math.PI * 2;
      rightTree.scale.set(baseScale, baseScale + Math.random() * 0.4, baseScale);
      scene.add(rightTree);
      placedTrees.push(rightTree);
    }
  }
  return placedTrees;
}


function setupControlsListeners() {
  window.addEventListener('keydown', e => keysPressed[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => delete keysPressed[e.key.toLowerCase()]);
}

function processCarControls(delta) {
  const steerInput = (keysPressed['a'] || keysPressed['arrowleft']) ? 1 : 
                     (keysPressed['d'] || keysPressed['arrowright']) ? -1 : 0;
  
  if (steerInput !== 0) {
    steeringAngle = THREE.MathUtils.clamp(
      steeringAngle + steerInput * VEHICLE_PHYSICS.steeringSpeed * delta,
      -VEHICLE_PHYSICS.maxSteering, VEHICLE_PHYSICS.maxSteering
    );
  } else {
    steeringAngle = THREE.MathUtils.damp(
      steeringAngle, 0, VEHICLE_PHYSICS.steeringReturn, delta
    );
  }

  engineForce = 0;
  if (keysPressed['w'] || keysPressed['arrowup']) {
    engineForce = VEHICLE_PHYSICS.acceleration;
  }
  if (keysPressed['s'] || keysPressed['arrowdown']) {
    engineForce = -VEHICLE_PHYSICS.brakeForce;
  }

  let acceleration = engineForce * delta;
  velocity += acceleration;
  velocity = THREE.MathUtils.clamp(velocity, -VEHICLE_PHYSICS.maxSpeed/1.5, VEHICLE_PHYSICS.maxSpeed); // Slower reverse
}

function applyVehicleFriction(delta) {
  if (engineForce === 0 || Math.sign(engineForce) !== Math.sign(velocity)) { // Apply friction if no engine force or if braking against motion
    const frictionMagnitude = Math.abs(VEHICLE_PHYSICS.friction * delta);
    if (Math.abs(velocity) < frictionMagnitude) {
        velocity = 0;
    } else {
        velocity -= Math.sign(velocity) * frictionMagnitude;
    }
  }
  if (Math.abs(velocity) < 0.01 && engineForce === 0) velocity = 0;
}

function updateVehicle(delta) {
  if (!car) return;

  if (Math.abs(steeringAngle) > 0.001) {
      const turnRadius = VEHICLE_PHYSICS.wheelBase / Math.sin(steeringAngle); // Use sin for more common Ackermann approx.
      const angularVel = velocity / turnRadius;
      car.rotation.y += angularVel * delta;
  }
  
  _v1.set(0, 0, 1).applyQuaternion(car.quaternion).multiplyScalar(velocity * delta);
  car.position.add(_v1);
  car.position.y = PATH_ELEMENT_Y; // Keep car on the defined path Y
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  if (car) {
    processCarControls(delta);
    applyVehicleFriction(delta);
    updateVehicle(delta);

    // Camera update
    const offset = _v2.set(0, cameraSettings.height, -cameraSettings.distance);
    offset.applyQuaternion(car.quaternion);
    const desiredCameraPosition = _v3.addVectors(car.position, offset);
    camera.position.lerp(desiredCameraPosition, cameraSettings.smoothing);
    
    controls.target.copy(car.position);
    controls.target.y += 1.0; // Look slightly above the car's origin for better perspective
    controls.update();
  }
  
  if (uiManager && car) {
    checkResumeProximity(car); // Pass car mesh directly
  }

  renderer.render(scene, camera);
}

async function init() {
  try {
    scene.background = new THREE.Color(0x87CEEB); // Sky blue

    const assets = await loadAssets();
    car = assets.loadedCar;
    helvetikerFont = assets.loadedFont; // Store preloaded font
    scene.add(car);

    trees = placeTreesAlongPath(assets.treeModel);

    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, PATH_LENGTH * 1.05, 1, 20); // Slightly longer, more segments
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x383838, // Darker road for visibility
        roughness: 0.85, 
        metalness: 0.1 
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = ROAD_Y; // Position road slightly above ground
    road.receiveShadow = true;
    scene.add(road);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 80;
    // controls.maxPolarAngle = Math.PI / 2 - 0.01; // Prevent camera going too low

    _v1.set(0, cameraSettings.height, -cameraSettings.distance).applyQuaternion(car.quaternion);
    camera.position.addVectors(car.position, _v1);
    controls.target.copy(car.position);
    controls.target.y += 1.0;
    controls.update();

    setupControlsListeners();
    uiManager = new UIManager();
    createResumeContent(pathCurve, uiManager);
    createUserInterface();

    animate();
    window.addEventListener('resize', onWindowResize);

  } catch (error) {
    console.error('Initialization error:', error);
    if (errorMessage) {
        errorMessage.textContent = 'Initialization Error: ' + (error.message || "Unknown error");
        errorMessage.style.display = 'block';
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}