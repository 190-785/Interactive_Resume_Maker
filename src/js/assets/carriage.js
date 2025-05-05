// src/js/assets/carriage.js
import * as THREE from 'three';

export default class Carriage {
  constructor() {
    this.group = new THREE.Group();
    this.clock = new THREE.Clock();
    this.facingAngle = 0;
    this.velocity = 0;
    this.steeringAngle = 0;
    this.maxSteeringAngle = Math.PI / 4;
    this.wheelBase = 1.8;
    this.steeringSpeed = 2.0;
    this.steeringReturn = 3.0;
    this.wheels = [];
    this.horseGroup = new THREE.Group();
    this._build();
  }

  _build() {
    const woodColor      = 0x8b5a2b;
    const darkWoodColor  = 0x654321;
    const ironColor      = 0x333333;
    const leatherColor   = 0x8B4513;
    const fabricColor    = 0x800020;
    const lanternEmissive= 0xffcc33;

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(2.5, 0.2, 1.0);
    const chassisMat = new THREE.MeshStandardMaterial({ color: darkWoodColor, roughness: 0.8, metalness: 0.1 });
    const chassis    = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 0.3, 0);
    chassis.castShadow = chassis.receiveShadow = true;
    this.group.add(chassis);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.8, 1.0, 1.2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.9, metalness: 0.05 });
    const cabin    = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.9, 0);
    cabin.castShadow = cabin.receiveShadow = true;
    this.group.add(cabin);

    // Windows & Frames
    const frameGeo = new THREE.BoxGeometry(0.05, 0.6, 0.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: darkWoodColor, roughness: 0.7, metalness: 0.2 });
    const windowGeo= new THREE.PlaneGeometry(0.6, 0.6);
    const windowMat= new THREE.MeshStandardMaterial({ color: 0x99CCFF, transparent: true, opacity: 0.3, side: THREE.DoubleSide });

    [[-0.93,0.9,0],[0.93,0.9,0]].forEach(pos => {
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(...pos);
      frame.castShadow = frame.receiveShadow = true;
      this.group.add(frame);

      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(pos[0]>0?0.91:-0.91, pos[1], pos[2]);
      win.rotation.y = Math.PI / 2;
      this.group.add(win);

      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.6, 0.03), frameMat);
      cross1.position.copy(win.position);
      cross1.rotation.y = Math.PI/2;
      this.group.add(cross1);

      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.6), frameMat);
      cross2.position.copy(win.position);
      cross2.rotation.y = Math.PI/2;
      this.group.add(cross2);
    });

    // Roof
    const roofGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.8, 16, 1, false, 0, Math.PI);
    const roofMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.9, metalness: 0.1 });
    const roof    = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.position.set(0, 1.5, 0);
    roof.castShadow = roof.receiveShadow = true;
    this.group.add(roof);

    ['0,1.4,0.6', '0,1.4,-0.6'].forEach(str => {
      const pos = str.split(',').map(Number);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.05,0.05), frameMat);
      trim.position.set(pos[0], pos[1], pos[2]);
      trim.castShadow = true;
      this.group.add(trim);
    });

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.8,0.1,0.8);
    const seatMat = new THREE.MeshStandardMaterial({ color: leatherColor, roughness: 0.9, metalness: 0.0 });
    const seat    = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(-1.0,0.5,0);
    seat.castShadow = seat.receiveShadow = true;
    this.group.add(seat);

    const backGeo = new THREE.BoxGeometry(0.1,0.3,0.7);
    const back    = new THREE.Mesh(backGeo, seatMat);
    back.position.set(-1.35,0.7,0);
    back.castShadow = back.receiveShadow = true;
    this.group.add(back);

    // Axles
    const axleGeo = new THREE.CylinderGeometry(0.05,0.05,1.4,8);
    const axleMat = new THREE.MeshStandardMaterial({ color: ironColor, roughness: 0.6, metalness: 0.8 });
    const frontAxle = new THREE.Mesh(axleGeo, axleMat);
    frontAxle.rotation.z = Math.PI/2;
    frontAxle.position.set(-0.9,0.2,0);
    this.group.add(frontAxle);

    const rearAxle = frontAxle.clone();
    rearAxle.position.set(0.9,0.2,0);
    this.group.add(rearAxle);

    this._createWheels();
    this._createLantern();
    this._createHorse();
  }

  _createWheels() {
    const positions = [
      [-0.9,0.2,-0.7],
      [-0.9,0.2, 0.7],
      [ 0.9,0.2,-0.7],
      [ 0.9,0.2, 0.7]
    ];
    const wheelGeo = new THREE.CylinderGeometry(0.3,0.3,0.1,8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.9, metalness: 0.1 });

    positions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(...pos);
      wheel.rotation.x = Math.PI/2;
      wheel.castShadow = wheel.receiveShadow = true;
      this.group.add(wheel);
      this.wheels.push(wheel);

      // Hub
      const hubGeo = new THREE.CylinderGeometry(0.1,0.1,0.12,8);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.7, metalness: 0.3 });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.copy(wheel.position);
      hub.rotation.x = Math.PI/2;
      hub.castShadow = true;
      this.group.add(hub);

      // Spokes
      for (let i = 0; i < 8; i++) {
        const spokeGeo = new THREE.BoxGeometry(0.05,0.03,0.25);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.7, metalness: 0.2 });
        const spoke = new THREE.Mesh(spokeGeo, spokeMat);
        spoke.position.copy(wheel.position);
        spoke.rotation.x = Math.PI/2;
        spoke.rotation.z = (i / 8) * Math.PI * 2;
        spoke.castShadow = true;
        wheel.add(spoke);
      }
    });
  }

  _createLantern() {
    const pos = [-1.2,0.7,0.5];
    const poleGeo = new THREE.CylinderGeometry(0.02,0.02,0.4,8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(...pos);
    pole.castShadow = true;
    this.group.add(pole);

    const lanternGeo = new THREE.BoxGeometry(0.15,0.15,0.15);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.6,
      metalness: 0.8,
      emissive: 0xffcc33,
      emissiveIntensity: 0.3
    });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.set(pos[0], pos[1] + 0.2, pos[2]);
    lantern.castShadow = true;
    this.group.add(lantern);

    const light = new THREE.PointLight(0xffcc33, 1, 5);
    light.position.copy(lantern.position);
    this.group.add(light);
  }

  _createHorse() {
    this.horseGroup.position.set(-2.2, 0, 0);
    this.group.add(this.horseGroup);

    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.7, 0);
    body.rotation.x = Math.PI/2;
    body.castShadow = body.receiveShadow = true;
    this.horseGroup.add(body);

    const neckGeo = new THREE.CylinderGeometry(0.15,0.2,0.6,8);
    const neck = new THREE.Mesh(neckGeo, bodyMat);
    neck.position.set(0.5,1.0,0);
    neck.rotation.z = -Math.PI/4;
    neck.castShadow = true;
    this.horseGroup.add(neck);

    const headGeo = new THREE.BoxGeometry(0.4,0.3,0.2);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0.8,1.3,0);
    head.castShadow = head.receiveShadow = true;
    this.horseGroup.add(head);

    const maneGeo = new THREE.BoxGeometry(0.3,0.1,0.25);
    const maneMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1.0, metalness: 0.0 });
    const mane = new THREE.Mesh(maneGeo, maneMat);
    mane.position.set(0.5,1.2,0);
    mane.rotation.z = -Math.PI/4;
    mane.castShadow = true;
    this.horseGroup.add(mane);

    const legPositions = [
      [ 0.3, 0,  0.2],
      [ 0.3, 0, -0.2],
      [-0.3, 0,  0.2],
      [-0.3, 0, -0.2]
    ];
    legPositions.forEach(pos => {
      const legGeo = new THREE.CylinderGeometry(0.05,0.05,0.6,8);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(...pos);
      leg.castShadow = leg.receiveShadow = true;
      this.horseGroup.add(leg);
    });

    const tailGeo = new THREE.CylinderGeometry(0.05,0.01,0.5,8);
    const tail = new THREE.Mesh(tailGeo, maneMat);
    tail.position.set(-0.6,0.7,0);
    tail.rotation.z = Math.PI/4;
    tail.castShadow = true;
    this.horseGroup.add(tail);

    const reinsGeo = new THREE.BoxGeometry(1.5,0.01,0.02);
    const reinsMat = new THREE.MeshStandardMaterial({ color: 0x663300, roughness: 0.9, metalness: 0.1 });
    const reins = new THREE.Mesh(reinsGeo, reinsMat);
    reins.position.set(-0.5,1.0,0.1);
    this.horseGroup.add(reins);
  }

  steer(input) {
    const delta = this.clock.getDelta();
    if (input !== 0) {
      this.steeringAngle = THREE.MathUtils.clamp(
        this.steeringAngle + input * this.steeringSpeed * delta,
        -this.maxSteeringAngle,
        this.maxSteeringAngle
      );
    } else {
      this.centerSteering(delta);
    }
  }

  centerSteering(delta) {
    if (this.steeringAngle > 0) {
      this.steeringAngle = Math.max(0, this.steeringAngle - this.steeringReturn * delta);
    } else if (this.steeringAngle < 0) {
      this.steeringAngle = Math.min(0, this.steeringAngle + this.steeringReturn * delta);
    }
  }

  accelerate(amount, delta) {
    this.velocity = THREE.MathUtils.clamp(this.velocity + amount * delta, -10, 20);
  }

  applyFriction(delta) {
    const friction = 5;
    if (this.velocity > 0) {
      this.velocity = Math.max(0, this.velocity - friction * delta);
    } else if (this.velocity < 0) {
      this.velocity = Math.min(0, this.velocity + friction * delta);
    }
  }

  update(delta) {
    const turnRadius   = this.wheelBase / Math.sin(this.steeringAngle || 0.0001);
    const angularVel   = this.velocity / turnRadius;
    this.facingAngle  += angularVel * delta;
    this.group.position.x += Math.sin(this.facingAngle) * this.velocity * delta;
    this.group.position.z += Math.cos(this.facingAngle) * this.velocity * delta;
    this.group.rotation.y   = this.facingAngle;

    // Wheel spin
    this.wheels.forEach(w => { w.rotation.x += this.velocity * delta * 3; });

    // Horse bob
    if (Math.abs(this.velocity) > 0.1) {
      this.horseGroup.position.y = 0.1 + Math.sin(Date.now()*0.01)*0.05;
    }
  }

  addToScene(scene) {
    scene.add(this.group);
  }
}
