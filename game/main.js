import * as THREE from 'three';
import { Cybertruck } from './Cybertruck.js';
import { JeffersonAve } from './JeffersonAve.js';
import { NavigationSystem } from './NavigationSystem.js';
import { CameraController } from './CameraController.js';
import { CameraIntro } from './CameraIntro.js';
import { TrafficSystem } from './TrafficSystem.js';
import { PedestrianSystem } from './PedestrianSystem.js';
import { InputManager } from './InputManager.js';
import { Minimap } from './Minimap.js';
import { CONFIG } from './config.js';

class CybertruckExperience {
  constructor() {
    this.clock = new THREE.Clock();
    this.isInDriveMode = true; // Start in drive mode
    this.introComplete = false;
    this.init();
  }
  
  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue for daytime
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 400); // Extended fog for long corridor
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    
    // Lighting
    this.setupLighting();
    
    // Create Jefferson Ave corridor
    this.jeffersonAve = new JeffersonAve(this.scene);
    
    // Create Cybertruck - spawn in Starbucks parking lot
    this.cybertruck = new Cybertruck(this.scene);
    const starbucksParking = { x: -50, y: 0.4, z: 830 }; // Starbucks parking lot
    this.cybertruck.group.position.set(starbucksParking.x, starbucksParking.y, starbucksParking.z);
    this.cybertruck.group.rotation.y = 0; // Face north (toward road)
    this.cybertruck.rotation = 0;
    
    // Camera intro (aerial shot) - zoom to Starbucks parking lot
    const starbucksPos = new THREE.Vector3(-50, 2, 830);
    this.cameraIntro = new CameraIntro(this.camera, starbucksPos);
    
    // Camera controller
    this.cameraController = new CameraController(
      this.camera,
      this.renderer,
      this.cybertruck
    );
    
    // Input manager
    this.inputManager = new InputManager();
    
    // Navigation system
    this.navigation = new NavigationSystem(this.scene, this.jeffersonAve.getLandmarks());
    
    // Traffic system
    this.trafficSystem = new TrafficSystem(this.scene);
    
    // Pedestrian system
    this.pedestrianSystem = new PedestrianSystem(this.scene);
    
    // Minimap
    this.minimap = new Minimap('minimapCanvas', this.cybertruck);
    
    // UI
    this.setupUI();
    
    // Event listeners
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Click anywhere to skip intro
    const skipIntroHint = document.getElementById('skipIntro');
    
    window.addEventListener('click', () => {
      if (this.cameraIntro.isActive()) {
        this.cameraIntro.skip();
        this.cameraController.switchToDrive();
        if (skipIntroHint) {
          skipIntroHint.classList.add('hidden');
        }
        console.log('⏭️ Intro skipped - drive mode active');
      }
    }, { once: true });
    
    // Start aerial intro
    this.cameraIntro.start();
    
    // Start animation loop
    this.animate();
  }
  
  setupLighting() {
    // Ambient light - bright daylight
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    // Main directional light - sun
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(100, 150, 100);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 300;
    mainLight.shadow.camera.left = -150;
    mainLight.shadow.camera.right = 150;
    mainLight.shadow.camera.top = 150;
    mainLight.shadow.camera.bottom = -150;
    this.scene.add(mainLight);
    
    // Hemisphere light for natural sky/ground gradient
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x4a4a4a, 0.6);
    this.scene.add(hemiLight);
  }
  
  setupUI() {
    const controlsHint = document.getElementById('controlsHint');
    const speedometer = document.getElementById('speedometer');
    const powerBar = document.getElementById('powerBar');
    const minimapContainer = document.getElementById('minimapContainer');
    const navigationPanel = document.getElementById('navigationPanel');
    const streetName = document.getElementById('streetName');
    
    this.speedometer = speedometer;
    this.powerBar = powerBar;
    this.minimapContainer = minimapContainer;
    this.navigationPanel = navigationPanel;
    this.streetName = streetName;
    this.speedValue = document.getElementById('speedValue');
    this.gearValue = document.getElementById('gearValue');
    this.powerFill = document.getElementById('powerFill');
    
    // Show UI elements immediately (already in drive mode)
    controlsHint.classList.add('visible');
    speedometer.classList.add('visible');
    powerBar.classList.add('visible');
    minimapContainer.classList.add('visible');
    navigationPanel.classList.add('visible');
    streetName.classList.add('visible');
    
    // Enable drive mode immediately
    this.inputManager.setDriveMode(true);
    
    // Navigation buttons
    document.getElementById('navWalmart').addEventListener('click', () => {
      this.navigation.setDestination('walmart');
      this.setActiveNavButton('navWalmart');
    });
    
    document.getElementById('navStarbucks').addEventListener('click', () => {
      this.navigation.setDestination('starbucks');
      this.setActiveNavButton('navStarbucks');
    });
    
    document.getElementById('navClear').addEventListener('click', () => {
      this.navigation.clearWaypoint();
      this.clearActiveNavButton();
    });
  }
  
  setActiveNavButton(buttonId) {
    // Clear all active states
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('active');
    });
    // Set active state
    document.getElementById(buttonId).classList.add('active');
  }
  
  clearActiveNavButton() {
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('active');
    });
  }
  
  updateStreetName() {
    const currentStreet = this.jeffersonAve.getCurrentStreet(this.cybertruck.getPosition().z);
    this.streetName.textContent = currentStreet;
  }
  
  updateSpeedometer() {
    // Convert speed to MPH (speed is in units/second, scale appropriately)
    const mph = Math.abs(this.cybertruck.speed * 2.5);
    this.speedValue.textContent = Math.round(mph);
    
    // Update gear indicator
    const input = this.inputManager.getInput();
    let gear = 'P';
    let gearClass = 'park';
    
    if (this.cybertruck.speed > 0.5) {
      gear = 'D';
      gearClass = 'drive';
    } else if (this.cybertruck.speed < -0.5) {
      gear = 'R';
      gearClass = 'reverse';
    }
    
    this.gearValue.textContent = gear;
    this.gearValue.className = `gear-value ${gearClass}`;
    
    // Update power bar (based on acceleration input)
    let powerPercent = 0;
    if (input.forward) {
      powerPercent = Math.min(100, (Math.abs(this.cybertruck.speed) / CONFIG.drive.maxSpeed) * 100);
    } else if (input.backward) {
      powerPercent = Math.min(50, (Math.abs(this.cybertruck.speed) / (CONFIG.drive.maxSpeed * 0.5)) * 50);
    }
    
    this.powerFill.style.width = powerPercent + '%';
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    // Handle camera intro
    if (this.cameraIntro.isActive()) {
      const introComplete = this.cameraIntro.update();
      
      if (introComplete && !this.introComplete) {
        this.introComplete = true;
        // After intro, switch to drive camera
        this.cameraController.switchToDrive();
        // Hide skip intro hint
        const skipIntroHint = document.getElementById('skipIntro');
        if (skipIntroHint) {
          skipIntroHint.classList.add('hidden');
        }
        console.log('🎬 Intro complete - drive mode active');
      }
      
      // During intro, don't update other systems
      this.renderer.render(this.scene, this.camera);
      return;
    }
    
    // Update traffic system (always running)
    this.trafficSystem.update(deltaTime, this.cybertruck.getPosition());
    
    // Update pedestrian system (always running)
    this.pedestrianSystem.update(deltaTime, this.cybertruck.getPosition());
    
    // Get truck input (adapter that converts keys to truck format)
    const truckInput = this.inputManager.getTruckInput();
    const collisionObjects = this.jeffersonAve.getCollisionObjects();
    
    // Update cybertruck (ONLY when in drive mode)
    if (this.isInDriveMode) {
      this.cybertruck.update(deltaTime, truckInput, collisionObjects);
      
      // Check traffic collision
      const hitVehicle = this.trafficSystem.checkCollision(this.cybertruck.getPosition());
      if (hitVehicle) {
        // Bounce back on collision
        this.cybertruck.speed *= 0.3;
        console.log('💥 Traffic collision!');
      }
      
      // Update navigation
      this.navigation.update();
      this.navigation.checkArrival(this.cybertruck.getPosition());
      
      // Update UI
      this.updateSpeedometer();
      this.updateStreetName();
      this.minimap.draw();
    }
    
    // Update camera
    this.cameraController.update();
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the experience
new CybertruckExperience();
