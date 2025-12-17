import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

export class Cybertruck {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    
    // Physics properties
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.rotation = Math.PI; // Face forward (toward +Z)
    
    this.model = null;
    this.wheels = [];
    this.headlights = [];
    this.isLoaded = false;
    
    // Create a simple placeholder first so truck exists immediately
    this.createPlaceholder();
    
    this.loadModel();
    scene.add(this.group);
  }
  
  createPlaceholder() {
    // Temporary placeholder until model loads
    const placeholderMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      metalness: 0.9,
      roughness: 0.2
    });
    
    const placeholderGeometry = new THREE.BoxGeometry(2.4, 1.5, 5);
    this.placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    this.placeholder.position.y = 0.75;
    this.placeholder.castShadow = true;
    this.group.add(this.placeholder);
  }
  
  loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      'https://rosebud.ai/assets/cybertruck-meshy-final.glb?ZlnI',
      (gltf) => {
        this.model = gltf.scene;
        
        // Apply materials and setup
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Enhance materials
            if (child.material) {
              child.material.metalness = Math.max(child.material.metalness || 0, 0.7);
              child.material.roughness = Math.min(child.material.roughness || 1, 0.3);
            }
          }
        });
        
        // Scale and position the model appropriately
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2.5 / size.length(); // Normalize to reasonable size
        this.model.scale.setScalar(scale);
        
        // Center the model
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        
        // Remove placeholder
        if (this.placeholder) {
          this.group.remove(this.placeholder);
          this.placeholder = null;
        }
        
        this.group.add(this.model);
        
        // Add headlights
        this.addHeadlights();
        
        this.isLoaded = true;
        console.log('Cybertruck model loaded successfully!');
      },
      (progress) => {
        if (progress.total > 0) {
          console.log('Loading Cybertruck:', (progress.loaded / progress.total * 100).toFixed(0) + '%');
        }
      },
      (error) => {
        console.error('Error loading Cybertruck model:', error);
        console.log('Using placeholder geometry');
        this.isLoaded = true; // Allow movement with placeholder
      }
    );
  }
  
  addHeadlights() {
    // Add spot lights for headlights (reduced intensity and no shadows to save performance)
    const leftLight = new THREE.SpotLight(0xffffee, 1.5, 40, Math.PI / 8, 0.5);
    leftLight.position.set(1, 0.8, 2.5);
    leftLight.target.position.set(1, 0, 10);
    leftLight.castShadow = false; // Disable shadows for headlights
    this.group.add(leftLight);
    this.group.add(leftLight.target);
    this.headlights.push(leftLight);
    
    const rightLight = new THREE.SpotLight(0xffffee, 1.5, 40, Math.PI / 8, 0.5);
    rightLight.position.set(-1, 0.8, 2.5);
    rightLight.target.position.set(-1, 0, 10);
    rightLight.castShadow = false; // Disable shadows for headlights
    this.group.add(rightLight);
    this.group.add(rightLight.target);
    this.headlights.push(rightLight);
    
    // Add emissive headlight meshes for visual effect
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const headlightGeometry = new THREE.CircleGeometry(0.15, 8);
    
    const leftHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlightMesh.position.set(1, 0.8, 2.5);
    leftHeadlightMesh.rotation.y = Math.PI;
    this.group.add(leftHeadlightMesh);
    
    const rightHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlightMesh.position.set(-1, 0.8, 2.5);
    rightHeadlightMesh.rotation.y = Math.PI;
    this.group.add(rightHeadlightMesh);
  }
  
  createFallbackTruck() {
    // Note: Placeholder is already created in constructor
    // Just enable headlights
    this.addHeadlights();
    this.isLoaded = true;
  }
  
  update(deltaTime, input, collisionObjects = []) {
    // Guard: Only update if in drive mode
    if (!input || !input.isDriveMode) {
      return;
    }
    
    const { acceleration, maxSpeed, turnSpeed, friction, brakeFriction } = CONFIG.drive;
    
    // Debug: Log input when receiving commands
    if (input.forward || input.backward || input.left || input.right) {
      console.log('🚗 Cybertruck.update() received input:', {
        forward: input.forward,
        backward: input.backward,
        left: input.left,
        right: input.right,
        brake: input.brake,
        currentSpeed: this.speed.toFixed(2)
      });
    }
    
    // Acceleration/Braking
    if (input.forward) {
      this.speed += acceleration * deltaTime;
      console.log('⚡ Accelerating! Speed:', this.speed.toFixed(2));
    } else if (input.backward) {
      this.speed -= acceleration * deltaTime * 0.6;
      console.log('⏪ Reversing! Speed:', this.speed.toFixed(2));
    } else {
      // Natural friction
      this.speed *= friction;
    }
    
    // Brake (Space or Shift)
    if (input.brake) {
      this.speed *= brakeFriction;
      console.log('🛑 Braking! Speed:', this.speed.toFixed(2));
    }
    
    // Clamp speed
    this.speed = Math.max(-maxSpeed * 0.5, Math.min(maxSpeed, this.speed));
    
    // Turning (only when moving)
    if (Math.abs(this.speed) > 0.1) {
      if (input.left) {
        this.rotation += turnSpeed * Math.abs(this.speed) / maxSpeed;
      }
      if (input.right) {
        this.rotation -= turnSpeed * Math.abs(this.speed) / maxSpeed;
      }
    }
    
    // Calculate new position
    const moveX = Math.sin(this.rotation) * this.speed * deltaTime;
    const moveZ = Math.cos(this.rotation) * this.speed * deltaTime;
    
    const newX = this.group.position.x + moveX;
    const newZ = this.group.position.z + moveZ;
    
    // Simple collision detection
    let canMove = true;
    const truckRadius = 3; // Collision radius
    
    for (const obj of collisionObjects) {
      const dx = newX - obj.x;
      const dz = newZ - obj.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < truckRadius + obj.radius) {
        canMove = false;
        this.speed *= 0.5; // Slow down on collision
        break;
      }
    }
    
    // Update position if no collision
    if (canMove) {
      this.group.position.x = newX;
      this.group.position.z = newZ;
    }
    
    this.group.rotation.y = this.rotation;
    
    // Update headlight targets to point forward
    this.headlights.forEach((light) => {
      const forward = new THREE.Vector3(
        Math.sin(this.rotation) * 10,
        0,
        Math.cos(this.rotation) * 10
      );
      light.target.position.copy(this.group.position).add(forward);
    });
    
    // Small amount of friction to eventually stop
    if (Math.abs(this.speed) < 0.05) {
      this.speed = 0;
    }
  }
  
  getPosition() {
    return this.group.position;
  }
  
  getRotation() {
    return this.rotation;
  }
}
