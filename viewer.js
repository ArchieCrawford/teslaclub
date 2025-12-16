import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

document.body.style.margin = "0";

toggleOverlay("Loading cybertruck-meshy.glb …");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(4, 2, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.0));

const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(6, 10, 4);
scene.add(key);

const loader = new GLTFLoader();
loader.load(
  "./public/models/cybertruck-meshy-final.glb",
  (gltf) => {
    const model = gltf.scene;

    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    autoCenter(model);
    scene.add(model);
    toggleOverlay("Loaded. Orbit to inspect silhouette, paint, and seams.");
  },
  undefined,
  (err) => {
    console.error(err);
    toggleOverlay("Failed to load ./public/models/cybertruck-meshy-final.glb. Place the file there and reload.");
  }
);

function autoCenter(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 4 / maxDim;
  model.scale.setScalar(scale);
}

function toggleOverlay(text) {
  const el = document.querySelector("#overlay");
  if (el) el.textContent = text;
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
