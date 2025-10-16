// main.js - robust version with error handling and fallback so page never hangs
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.156.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.156.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.156.0/examples/jsm/controls/OrbitControls.js';

const $loading = document.getElementById('loading');
const $error = document.getElementById('errorBox');
function showError(msg) {
  console.error(msg);
  $error.style.display = 'block';
  const p = document.createElement('div');
  p.textContent = msg;
  $error.appendChild(p);
}

// global error catcher
window.addEventListener('error', (ev) => {
  showError('Uncaught error: ' + (ev && ev.message ? ev.message : JSON.stringify(ev)));
  $loading.style.display = 'none';
});
window.addEventListener('unhandledrejection', (ev) => {
  showError('Unhandled promise rejection: ' + (ev && ev.reason ? ev.reason : JSON.stringify(ev)));
  $loading.style.display = 'none';
});

// ---------- Basic scene ----------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x97c0ff, 0.0006);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Camera & Controls ----------
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
camera.position.set(0, 5, -12);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;

// ---------- Lights ----------
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(100, 200, 100);
sun.castShadow = true;
sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x99d3ff, 0x404040, 0.6);
scene.add(hemi);

// ---------- Ground ----------
const size = 2048;
const segments = 256;
const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
geometry.rotateX(-Math.PI / 2);
for (let i = 0; i < geometry.attributes.position.count; i++) {
  const x = geometry.attributes.position.getX(i);
  const z = geometry.attributes.position.getZ(i);
  const y = (Math.sin(x * 0.01) + Math.cos(z * 0.007)) * 8;
  geometry.attributes.position.setY(i, y);
}
geometry.computeVertexNormals();
const mat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(geometry, mat);
ground.receiveShadow = true;
scene.add(ground);

// ---------- Simple obstacles ----------
const boxGeo = new THREE.BoxGeometry(6, 6, 6);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
for (let i = 0; i < 80; i++) {
  const m = new THREE.Mesh(boxGeo, boxMat);
  m.position.set((Math.random() - 0.5) * 1500, 3, (Math.random() - 0.5) * 1500);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// ---------- Vehicle skeleton ----------
const vehicle = {
  mesh: null,
  position: new THREE.Vector3(0, 20, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  steerAngle: 0,
  mass: 1800,
  wheelBase: 2.7,
  maxSteer: Math.PI / 6,
  dragCoef: 0.4257,
  rollingResistance: 12
};

function makePlaceholderCar() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 5.0), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
  body.position.y = 0.7; body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const positions = [[-1.0, 0.2, -1.8],[1.0,0.2,-1.8],[-1.0,0.2,1.8],[1.0,0.2,1.8]];
  positions.forEach(p => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true; group.add(w);
  });
  return group;
}

// attempt to load ./assets/car.glb; if it fails, fallback to placeholder
const loader = new GLTFLoader();
loader.load('./assets/car.glb', gltf => {
  try {
    const carModel = gltf.scene;
    carModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    carModel.scale.set(1.0,1.0,1.0);
    vehicle.mesh = carModel;
    vehicle.mesh.position.copy(vehicle.position);
    scene.add(vehicle.mesh);
    $loading.style.display = 'none';
  } catch (e) {
    showError('Error placing GLTF model: ' + e.message);
    fallback();
  }
}, xhr => {
  // optional progress
}, err => {
  showError('GLTF load failed (./assets/car.glb). Falling back to placeholder. Details: ' + (err && err.message ? err.message : JSON.stringify(err)));
  fallback();
});

function fallback() {
  vehicle.mesh = makePlaceholderCar();
  vehicle.mesh.position.copy(vehicle.position);
  scene.add(vehicle.mesh);
  $loading.style.display = 'none';
}

// ---------- Input ----------
const keys = { forward:false, back:false, left:false, right:false, handbrake:false };
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'w') keys.forward = true;
  if (e.key.toLowerCase() === 's') keys.back = true;
  if (e.key.toLowerCase() === 'a') keys.left = true;
  if (e.key.toLowerCase() === 'd') keys.right = true;
  if (e.code === 'Space') keys.handbrake = true;
  if (e.key.toLowerCase() === 'c') toggleCamera();
  if (e.key.toLowerCase() === 'r') resetVehicle();
});
window.addEventListener('keyup', e => {
  if (e.key.toLowerCase() === 'w') keys.forward = false;
  if (e.key.toLowerCase() === 's') keys.back = false;
  if (e.key.toLowerCase() === 'a') keys.left = false;
  if (e.key.toLowerCase() === 'd') keys.right = false;
  if (e.code === 'Space') keys.handbrake = false;
});

// ---------- Camera ----------
let chaseCam = true;
function toggleCamera() { chaseCam = !chaseCam; if (!chaseCam) controls.target.copy(vehicle.mesh.position); }
function updateCamera(dt) {
  if (chaseCam && vehicle.mesh) {
    const offset = new THREE.Vector3(0, 2.2, -6);
    offset.applyQuaternion(vehicle.mesh.quaternion);
    const desired = new THREE.Vector3().copy(vehicle.mesh.position).add(offset);
    camera.position.lerp(desired, 1 - Math.pow(0.01, dt));
    const lookAt = new THREE.Vector3().copy(vehicle.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
    camera.lookAt(lookAt);
  } else {
    controls.update();
  }
}

// ---------- Ray ground check ----------
const raycaster = new THREE.Raycaster();
function getGroundHeightAt(x, z) {
  raycaster.set(new THREE.Vector3(x, 2000, z), new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObject(ground);
  if (hits.length) return hits[0].point.y;
  return -1000;
}

// ---------- Physics step (simple) ----------
let last = performance.now();
function physicsStep() {
  const now = performance.now();
  let dt = (now - last) / 1000;
  if (dt > 0.05) dt = 0.05;
  last = now;

  if (!vehicle.mesh) return dt;

  const throttle = keys.forward ? 1 : (keys.back ? -0.6 : 0);
  const steerInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const maxEngine = 8000;
  const targetSteer = steerInput * vehicle.maxSteer;
  vehicle.steerAngle = THREE.MathUtils.lerp(vehicle.steerAngle, targetSteer, 5 * dt);

  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.mesh.quaternion).normalize();
  const engineF = forward.clone().multiplyScalar(throttle * maxEngine);
  const speed = vehicle.velocity.length();
  const drag = vehicle.velocity.clone().multiplyScalar(-vehicle.dragCoef * speed);
  const rolling = vehicle.velocity.clone().multiplyScalar(-vehicle.rollingResistance);
  const net = new THREE.Vector3().add(engineF).add(drag).add(rolling);
  const accel = net.clone().divideScalar(vehicle.mass);

  vehicle.velocity.add(accel.multiplyScalar(dt));

  const angularVel = (vehicle.velocity.z !== 0 ? (vehicle.velocity.length() / vehicle.wheelBase) * Math.tan(vehicle.steerAngle) : 0);
  const deltaYaw = angularVel * dt;
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), deltaYaw);
  vehicle.mesh.quaternion.multiplyQuaternions(yawQuat, vehicle.mesh.quaternion);

  const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.mesh.quaternion);
  vehicle.mesh.position.addScaledVector(localForward, vehicle.velocity.length() * dt * Math.sign(vehicle.velocity.dot(localForward)));

  const groundY = getGroundHeightAt(vehicle.mesh.position.x, vehicle.mesh.position.z);
  const desiredY = groundY + 0.8;
  const diff = desiredY - vehicle.mesh.position.y;
  const suspensionK = 80;
  vehicle.velocity.y += diff * suspensionK * dt - 9.81 * dt;
  vehicle.mesh.position.y += vehicle.velocity.y * dt;
}

function resetVehicle() {
  if (!vehicle.mesh) return;
  vehicle.mesh.position.set(0, 20, 0);
  vehicle.mesh.quaternion.set(0,0,0,1);
  vehicle.velocity.set(0,0,0);
}

// ---------- render loop ----------
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  physicsStep();
  controls.enabled = !chaseCam;
  updateCamera(dt);
  renderer.render(scene, camera);
}
animate();
