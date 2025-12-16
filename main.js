import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const app = document.querySelector("#app");
const enterDriveBtn = document.querySelector("#enterDrive");
const backShowroomBtn = document.querySelector("#backShowroom");
const modeBadge = document.querySelector("#modeBadge");
const cta = document.querySelector("#cta");
const crosshair = document.querySelector("#crosshair");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050607, 18, 140);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(4, 2, 6);

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

// Extra fill so dark materials still read while debugging.
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// Debug helpers to visualize origin and scale; remove later if desired.
scene.add(new THREE.AxesHelper(2));
scene.add(new THREE.GridHelper(20, 20));

const floorGeo = new THREE.CircleGeometry(18, 64);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.95, metalness: 0.05 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const grid = new THREE.GridHelper(60, 60, 0x1b202a, 0x11151c);
grid.position.y = 0.001;
grid.material.opacity = 0.45;
grid.material.transparent = true;
scene.add(grid);

const loader = new GLTFLoader();

let truck = null;
let truckRoot = new THREE.Group();
let truckYOffset = 0;
scene.add(truckRoot);

let mode = "showroom";

const state = {
  yaw: 0,
  pitch: 0,
  keys: new Set(),
  vel: new THREE.Vector3(),
  speed: 10,
  turn: 0,
};

function setMode(next) {
  mode = next;
  modeBadge.textContent = next.toUpperCase();
  const driving = mode === "drive";
  backShowroomBtn.style.display = driving ? "inline-block" : "none";
  enterDriveBtn.style.display = driving ? "none" : "inline-block";
  cta.style.opacity = driving ? "0.55" : "1";
  crosshair.style.display = driving ? "block" : "none";
  renderer.domElement.style.cursor = driving ? "none" : "pointer";

  if (!driving) document.exitPointerLock?.();
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
}

function loadTruck() {
  return new Promise((resolve, reject) => {
    loader.load(
      "./models/cybertruck-meshy-final.glb",
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
        fitTruck();

        const box = new THREE.Box3().setFromObject(truck);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log("Model size:", size, "center:", center);

        truck.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.6;

        camera.position.set(0, maxDim * 0.35, cameraZ);
        camera.near = Math.max(maxDim / 100, 0.01);
        camera.far = Math.max(maxDim * 100, 200);
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

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
  camera.lookAt(0, 1.0, 0);

  if (truck) {
    truckRoot.rotation.y = THREE.MathUtils.damp(truckRoot.rotation.y, truckRoot.rotation.y + dt * 0.25, 2.5, dt);
  }
}

function driveUpdate(dt) {
  const forward = state.keys.has("KeyW") ? 1 : 0;
  const back = state.keys.has("KeyS") ? 1 : 0;
  const left = state.keys.has("KeyA") ? 1 : 0;
  const right = state.keys.has("KeyD") ? 1 : 0;

  const accel = (forward - back) * state.speed;
  const steer = (right - left);

  state.turn = THREE.MathUtils.damp(state.turn, steer * 1.6, 8, dt);

  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
  state.vel.addScaledVector(dir, accel * dt);
  state.vel.multiplyScalar(Math.pow(0.04, dt));

  if (truckRoot) {
    truckRoot.rotation.y = state.yaw;
    truckRoot.position.addScaledVector(state.vel, dt);
    truck.position.y = truckYOffset;
    truckRoot.position.y = 0;
    state.yaw += state.turn * dt * Math.min(state.vel.length() * 0.35 + 0.25, 2.0);
  }

  const chaseBack = new THREE.Vector3(0, 2.2, 7.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
  const target = truckRoot.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const desiredCam = target.clone().add(chaseBack);

  camera.position.lerp(desiredCam, 1 - Math.pow(0.001, dt));
  camera.lookAt(target);
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
    renderer.domElement.requestPointerLock?.();
  }
});

enterDriveBtn.addEventListener("click", () => {
  setMode("drive");
  renderer.domElement.requestPointerLock?.();
});

backShowroomBtn.addEventListener("click", () => {
  truckRoot.position.set(0, 0, 0);
  truckRoot.rotation.set(0, 0, 0);
  state.vel.set(0, 0, 0);
  state.yaw = 0;
  state.pitch = 0;
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
  truckRoot.add(fallback);
  fallback.position.y = 0.8;
});

setMode("showroom");

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (mode === "showroom") showroomCamera(dt);
  if (mode === "drive") driveUpdate(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
