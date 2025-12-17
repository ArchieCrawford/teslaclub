import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { JeffersonAve } from "./JeffersonAve.js";
import { TrafficSystem } from "./TrafficSystem.js";
import { PedestrianSystem } from "./PedestrianSystem.js";
import { Minimap } from "./Minimap.js";

const app = document.querySelector("#app");
const enterDriveBtn = document.querySelector("#enterDrive");
const backShowroomBtn = document.querySelector("#backShowroom");
const modeBadge = document.querySelector("#modeBadge");
const cta = document.querySelector("#cta");
const crosshair = document.querySelector("#crosshair");
const ctaHint = document.querySelector("#hint");
const minimapCanvas = document.querySelector("#minimap");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ecffb, 24, 1400);
scene.background = new THREE.Color(0x9ecffb);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(4, 2, 6);
camera.updateProjectionMatrix();

const clock = new THREE.Clock();

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0a0b0c, 0.85);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(6, 10, 6);
key.castShadow = false;
scene.add(key);

const rim = new THREE.DirectionalLight(0x9bd0ff, 0.5);
rim.position.set(-10, 6, -10);
scene.add(rim);

const sun = new THREE.DirectionalLight(0xfff0d0, 1.2);
sun.position.set(20, 40, 12);
sun.castShadow = false;
scene.add(sun);

// Extra fill so dark materials still read while debugging.
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// Debug helpers (hidden to avoid sticking through the truck)
const axesHelper = new THREE.AxesHelper(2);
const helperGrid = new THREE.GridHelper(20, 20);
axesHelper.visible = false;
helperGrid.visible = false;
scene.add(axesHelper);
scene.add(helperGrid);

// Large ground plane with grass tint
const groundGeo = new THREE.CircleGeometry(280, 64);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3c6432, roughness: 0.95, metalness: 0.02 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

// Showroom pad + parking stripes
const floorGeo = new THREE.CircleGeometry(22, 64);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.9, metalness: 0.08 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const parking = new THREE.Mesh(
  new THREE.RingGeometry(12, 20, 48, 1, Math.PI * 0.05, Math.PI * 0.9),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
);
parking.rotation.x = -Math.PI / 2;
parking.position.y = 0.002;
scene.add(parking);

const grid = new THREE.GridHelper(60, 60, 0x1b202a, 0x11151c);
grid.position.y = 0.003;
grid.material.opacity = 0.25;
grid.material.transparent = true;
scene.add(grid);

const loader = new GLTFLoader();

let truck = null;
let truckRoot = new THREE.Group();
let truckYOffset = 0;
scene.add(truckRoot);

let jefferson = null;
let traffic = null;
let pedestrians = null;
let minimap = null;
const JEFFERSON_START = new THREE.Vector3(0, 0, 40);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const forwardBase = new THREE.Vector3(1, 0, 0); // GLB forward is +X
const cameraOffsetLocal = new THREE.Vector3(-7.4, 2.1, 0); // behind the truck in its local frame
const targetOffset = new THREE.Vector3(0, 1.2, 0);

let mode = "showroom";
const dayNight = {
  cycleMs: 5 * 60 * 60 * 1000, // 5 hours real time
  t: 0,
};

const state = {
  yaw: 0,
  pitch: 0,
  keys: new Set(),
  speed: 0,
  maxSpeed: 22,
  accel: 18,
  brake: 28,
  drag: 6,
  steer: 0,
  steerRate: 8,
  maxSteer: 0.75,
};

function ensureJefferson() {
  if (!jefferson) jefferson = new JeffersonAve(scene);
  if (!traffic) traffic = new TrafficSystem(scene);
  if (!pedestrians) pedestrians = new PedestrianSystem(scene);
}

function resetShowroomPose() {
  truckRoot.position.set(0, 0, 0);
  truckRoot.rotation.set(0, 0, 0);
  state.speed = 0;
  state.steer = 0;
  state.yaw = 0;
  state.pitch = 0;
  floor.visible = true;
  grid.visible = true;
  axesHelper.visible = false;
  helperGrid.visible = false;
}

function syncCameraToTruck() {
  const heading = state.yaw;
  const target = truckRoot.position.clone().add(targetOffset);
  const back = cameraOffsetLocal.clone().applyAxisAngle(Y_AXIS, heading);
  const desired = target.clone().add(back);
  camera.position.copy(desired);
  camera.lookAt(target);
}

function jumpToJefferson() {
  ensureJefferson();
  state.speed = 0;
  state.steer = 0;
  state.yaw = -Math.PI / 2; // face down Jefferson toward the landmarks (+Z)
  truckRoot.position.copy(JEFFERSON_START);
  truckRoot.rotation.set(0, state.yaw, 0);
  truckRoot.position.y = 0;
  if (truck) truck.position.y = truckYOffset;
  floor.visible = false;
  grid.visible = false;
  axesHelper.visible = false;
  helperGrid.visible = false;
  syncCameraToTruck();
}

function setMode(next) {
  mode = next;
  modeBadge.textContent = next.toUpperCase();
  const driving = mode === "drive";
  backShowroomBtn.style.display = driving ? "inline-block" : "none";
  enterDriveBtn.style.display = driving ? "none" : "inline-block";
  cta.style.opacity = driving ? "0.55" : "1";
  cta.style.display = driving ? "none" : "block";
  crosshair.style.display = driving ? "block" : "none";
  renderer.domElement.style.cursor = driving ? "none" : "pointer";

  floor.visible = !driving;
  grid.visible = !driving;
  axesHelper.visible = false;
  helperGrid.visible = false;

  if (driving) {
    jumpToJefferson();
    if (!minimap && minimapCanvas) {
      minimap = new Minimap("minimap", {
        getPosition: () => truckRoot.position,
        getRotation: () => state.yaw,
      });
    }
    renderer.domElement.requestPointerLock?.();
  } else {
    resetShowroomPose();
    document.exitPointerLock?.();
  }
}

function fitTruck() {
  if (!truck) return;
  const box = new THREE.Box3().setFromObject(truck);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3.2 / maxDim;
  truck.scale.setScalar(scale);

  // Recentre, then lift so the lowest point rests on the floor with a tiny gap.
  const box2 = new THREE.Box3().setFromObject(truck);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  truck.position.sub(center);

  const boxAfter = new THREE.Box3().setFromObject(truck);
  const minY = boxAfter.min.y;
  truck.position.y -= minY;
  truck.position.y += Math.max(0.05, maxDim * 0.02); // lift a bit more so wheels clear the floor
  truckYOffset = truck.position.y;

  const framed = new THREE.Box3().setFromObject(truck);
  const s = framed.getSize(new THREE.Vector3());
  const maxDim2 = Math.max(s.x, s.y, s.z);
  camera.position.set(0, maxDim2 * 0.35, maxDim2 * 1.6);
  camera.lookAt(0, 1.2, 0);
  console.log("Model size:", s, "center:", framed.getCenter(new THREE.Vector3()));
}

function loadTruck() {
  return new Promise((resolve, reject) => {
    loader.load(
      "/models/cybertruck-meshy-final.glb",
      (gltf) => {
        truck = gltf.scene;

        console.log("GLB loaded:", gltf);

        truck.traverse((o) => {
          if (o.isMesh) {
            o.frustumCulled = false;
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material?.metalness !== undefined) o.material.metalness = Math.min(o.material.metalness + 0.15, 1);
            if (o.material?.roughness !== undefined) o.material.roughness = Math.max(o.material.roughness - 0.1, 0);
          }
        });

        truckRoot.add(truck);
        // If your model faces +X, rotate it so it faces -Z
        //truck.rotation.y = -Math.PI / 2;
       truck.rotation.y = Math.PI / 2;

        fitTruck();

        resolve();
      },
      (xhr) => console.log(`Loading ${(xhr.total ? (xhr.loaded / xhr.total) * 100 : 0).toFixed(1)}%`),
      (err) => {
        console.error("GLB failed to load:", err);
        reject(err);
      }
    );
  });
}

function showroomCamera(dt) {
  const t = performance.now() * 0.00025;
  const r = 9.0;
  camera.position.set(Math.cos(t) * r, 2.2, Math.sin(t) * r);
  camera.lookAt(0, 1.4, 0); // aim a bit higher so the framed model sits visually higher

  if (truck) {
    truckRoot.rotation.y = THREE.MathUtils.damp(truckRoot.rotation.y, truckRoot.rotation.y + dt * 0.25, 2.5, dt);
  }
}

function driveUpdate(dt) {
  const W = state.keys.has("KeyW") || state.keys.has("ArrowUp");
  const S = state.keys.has("KeyS") || state.keys.has("ArrowDown");
  const A = state.keys.has("KeyA") || state.keys.has("ArrowLeft");
  const D = state.keys.has("KeyD") || state.keys.has("ArrowRight");

  const throttle = (W ? 1 : 0) + (S ? -1 : 0);
  const steerIn = (D ? 1 : 0) + (A ? -1 : 0);

  // Speed update (car-like)
  if (throttle > 0) state.speed += state.accel * dt;
  else if (throttle < 0) state.speed -= state.brake * dt;
  else {
    const sign = Math.sign(state.speed);
    const decel = Math.min(Math.abs(state.speed), state.drag * dt);
    state.speed -= sign * decel;
  }

  state.speed = THREE.MathUtils.clamp(state.speed, -state.maxSpeed * 0.35, state.maxSpeed);

  // Steering smooth + speed-sensitive
  state.steer = THREE.MathUtils.damp(state.steer, steerIn, state.steerRate, dt);

  const speed01 = THREE.MathUtils.clamp(Math.abs(state.speed) / state.maxSpeed, 0, 1);
  const steerStrength = THREE.MathUtils.lerp(state.maxSteer, 0.18, speed01);

  // Invert yaw sign so D=right turns right in world space
  const yawRate = -state.steer * steerStrength * (0.6 + 1.4 * speed01) * (state.speed >= 0 ? 1 : -1);
  state.yaw += yawRate * dt;

  // Move forward using the GLB's +X forward axis
  const heading = state.yaw;
  const forward = forwardBase.clone().applyAxisAngle(Y_AXIS, heading);
  truckRoot.position.addScaledVector(forward, state.speed * dt);
  truckRoot.rotation.y = heading;

  // Fake suspension bob (speed scaled)
  const bob = Math.sin(performance.now() * 0.01) * 0.02 * speed01;
  truck.position.y = truckYOffset + bob;
  truckRoot.position.y = 0;

  // Camera chase (springy follow)
  const target = truckRoot.position.clone().add(targetOffset);
  const back = cameraOffsetLocal.clone().applyAxisAngle(Y_AXIS, heading);
  const desired = target.clone().add(back);

  camera.position.lerp(desired, 1 - Math.pow(0.0008, dt));
  camera.lookAt(target);
}

function updateDayNight(dt) {
  // Advance cycle
  dayNight.t = (dayNight.t + dt * 1000) % dayNight.cycleMs;
  const phase = dayNight.t / dayNight.cycleMs; // 0..1

  // Map to brightness curve (day at 0.25, night at 0.75)
  const sunUp = Math.max(0, Math.sin(phase * Math.PI * 2));
  const night = 1 - sunUp;

  const skyDay = new THREE.Color(0x9ecffb);
  const skyNight = new THREE.Color(0x0a0c12);
  scene.background = skyDay.clone().lerp(skyNight, night * 0.7);
  scene.fog.color = skyDay.clone().lerp(skyNight, night * 0.7);

  const fogNear = THREE.MathUtils.lerp(18, 8, night);
  const fogFar = THREE.MathUtils.lerp(1400, 420, night);
  scene.fog.near = fogNear;
  scene.fog.far = fogFar;

  hemi.intensity = THREE.MathUtils.lerp(0.95, 0.2, night);
  hemi.color.set(0xbfd9ff).lerp(new THREE.Color(0x304050), night);
  hemi.groundColor.set(0x0a0b0c).lerp(new THREE.Color(0x020305), night);

  sun.intensity = THREE.MathUtils.lerp(1.25, 0.08, night);
  sun.color.set(0xfff0d0).lerp(new THREE.Color(0x8899ff), night * 0.6);
  sun.position.set(20, THREE.MathUtils.lerp(40, 4, night), 12);

  ambient.intensity = THREE.MathUtils.lerp(0.5, 0.12, night);
  ambient.color.set(0xffffff).lerp(new THREE.Color(0x224466), night);
}

function rayHitTruck(clientX, clientY) {
  if (!truck) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x, y }, camera);

  const hits = ray.intersectObject(truckRoot, true);
  return hits.length > 0;
}

renderer.domElement.addEventListener("click", (e) => {
  if (mode === "showroom" && rayHitTruck(e.clientX, e.clientY)) {
    setMode("drive");
  }
});

enterDriveBtn.addEventListener("click", () => {
  setMode("drive");
});

backShowroomBtn.addEventListener("click", () => {
  setMode("showroom");
});

addEventListener("keydown", (e) => state.keys.add(e.code));
addEventListener("keyup", (e) => state.keys.delete(e.code));

addEventListener("mousemove", (e) => {
  if (mode !== "drive") return;
  if (document.pointerLockElement !== renderer.domElement) return;
  state.yaw -= e.movementX * 0.0022;
  state.pitch -= e.movementY * 0.0016;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -0.65, 0.45);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await loadTruck().catch(() => {
  const fallback = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.1, 5.6),
    new THREE.MeshStandardMaterial({ color: 0x8aa0b7, metalness: 0.6, roughness: 0.25 })
  );
  truck = fallback;
  truckRoot.add(fallback);
  fallback.position.y = 0.8;
});

setMode("showroom");

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (mode === "showroom") showroomCamera(dt);
  if (mode === "drive") {
    driveUpdate(dt);
    traffic?.update(dt, truckRoot.position);
    pedestrians?.update(dt, truckRoot.position);
    minimap?.draw();
  }
  updateDayNight(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
