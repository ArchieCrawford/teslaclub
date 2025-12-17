// Game configuration and constants
export const CONFIG = {
  // Cybertruck dimensions (based on real specs scaled down)
  truck: {
    width: 2.4,
    height: 1.9,
    length: 5.8,
    wheelRadius: 0.4,
    wheelWidth: 0.3,
    wheelOffset: 2.4
  },
  
  // Driving physics
  drive: {
    acceleration: 1.2,
    maxSpeed: 50,
    turnSpeed: 0.025,
    friction: 0.96,
    brakeFriction: 0.85
  },
  
  // Camera settings
  camera: {
    showroom: {
      distance: 15,
      height: 5,
      rotationSpeed: 0.0005
    },
    drive: {
      distance: 12,
      height: 4,
      followSpeed: 0.1
    }
  },
  
  // Showroom
  showroom: {
    size: 60,
    floorLevel: 0
  }
};
