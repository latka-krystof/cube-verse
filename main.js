import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as dat from 'dat.gui';

// Difficulty selection and menu logic
let scrambleMoves = 0; // Default difficulty

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(60, 50, -270);
controls.target.set(0, 42, -316);
camera.lookAt(0, 42, -316);
controls.enabled = true;

scene.rotation.set(0, 0, 0);

renderer.setAnimationLoop( animate );

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const faceColors = [0x00FFEA, 0xffffff, 0x98D136, 0xD97DF5, 0x6D5CED, 0xEC4A75]
const cubeSize = 2;
const stickerSize = 1.8;
const stickerRaise = 0.01;
const spacing = 0.05;
const increment = cubeSize + spacing;
const maxExtent = (cubeSize * 3 + spacing * 2 + 2 * stickerRaise) / 2;

const colorState = {
    right: '#00FFEA',  
    left: '#FFFFFF',  
    top: '#98D136',    
    bottom: '#D97DF5', 
    front: '#6D5CED',  
    back: '#EC4A75',   
};

// Create GUI
const gui = new dat.GUI();
gui.hide();
const colorsFolder = gui.addFolder('Face Colors');

// Add color controls
colorsFolder.addColor(colorState, 'right').name('Right Face').onChange(updateColors);
colorsFolder.addColor(colorState, 'left').name('Left Face').onChange(updateColors);
colorsFolder.addColor(colorState, 'top').name('Top Face').onChange(updateColors);
colorsFolder.addColor(colorState, 'bottom').name('Bottom Face').onChange(updateColors);
colorsFolder.addColor(colorState, 'front').name('Front Face').onChange(updateColors);
colorsFolder.addColor(colorState, 'back').name('Back Face').onChange(updateColors);

colorsFolder.open();

let cubes = [];

let isMouseDown = false;
let lastCube = null;

window.addEventListener('mousedown', function (event) {
    const intersects = getRayIntersects(event);
    if (intersects.length > 0) {
        let intersectedObj = intersects[0].object;
		let face = intersects[0].face;
		let faceCentroid = calculateFaceCentroid(intersectedObj.geometry, face);
		faceCentroid.applyMatrix4(intersectedObj.matrixWorld);
		while (intersectedObj.parent && !intersectedObj.rubikPosition) {
			intersectedObj = intersectedObj.parent;
		}
        onCubeMouseDown(event, intersectedObj, faceCentroid);
        isMouseDown = true;
    }
});

window.addEventListener('mouseup', function (event) {
    if (isMouseDown) {
		const intersects = getRayIntersects(event);
		if (intersects.length > 0) {
			let intersectedObj = intersects[0].object;
			while (intersectedObj.parent && !intersectedObj.rubikPosition) {
				intersectedObj = intersectedObj.parent;
			}
			onCubeMouseUp(event, intersectedObj);
			isMouseDown = false;
		} else if (lastCube) {
			onCubeMouseUp(event, lastCube);
		}
    }
});

let INTERSECTED;

window.addEventListener('mousemove', function (event) {
    const intersects = getRayIntersects(event);
    if ( intersects.length > 0 ) {
        if ( INTERSECTED != intersects[ 0 ].object ) {
            if ( INTERSECTED ) { INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex ) };
            INTERSECTED = intersects[ 0 ].object;
            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
            INTERSECTED.material.emissive.setHex( 0x878787 );
        }
    } else {
        if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
        INTERSECTED = null;
    }
});

// texture loading
const textureLoader = new THREE.TextureLoader();
function loadTexture(path, name) {
    return textureLoader.load(
        path,
        () => console.log(`${name} loaded successfully`),
        undefined, // Optional: progress handler
        (err) => console.error(`Error loading ${name}:`, err)
    );
}

const normalMap = loadTexture('assets/normal.png');
const roughnessMap = loadTexture('assets/roughness.png');
const displacementMap = loadTexture('assets/height.png');
const baseColorMap = loadTexture('assets/basecolor.png');
const aoMap = loadTexture('assets/ao.png');
const metallicMap = loadTexture('assets/metallic.png');

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); 
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(2, 3, 6);
scene.add(directionalLight);

const pointLights = [
    { color: 0xffffff, intensity: 0.5, position: [2, 3, 3] },    
    { color: 0xffffff, intensity: 0.5, position: [-5, 6, 10] },
    { color: 0xffffff, intensity: 0.5, position: [1, 8, -10] },    
    { color: 0xffffff, intensity: 0.5, position: [7, 5, 10] }
];

pointLights.forEach(light => {
    const pointLight = new THREE.PointLight(light.color, light.intensity);
    pointLight.position.set(...light.position);  // Spread operator to set x, y, z
    scene.add(pointLight);
});

function newCube(x, y, z) {
    const cubeGeom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x000000), emissive: 0x000000 });
    const cube = new THREE.Mesh(cubeGeom, cubeMaterial);
    cube.position.set(x, y, z);

    cube.castShadow = true;
    cube.receiveShadow = true;

    // Create and position stickers on each face
    const sticker_positions = [
        { face: 'right', position: [cubeSize / 2 + 0.01, 0, 0], rotation: [0, Math.PI / 2, 0] }, // right
        { face: 'left', position: [-cubeSize / 2 - 0.01, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // left
        { face: 'top', position: [0, cubeSize / 2 + 0.01, 0], rotation: [-Math.PI / 2, 0, 0] }, // top
        { face: 'bottom', position: [0, -cubeSize / 2 - 0.01, 0], rotation: [Math.PI / 2, 0, 0] }, // bottom
        { face: 'front', position: [0, 0, cubeSize / 2 + 0.01], rotation: [0, 0, 0] }, //front
        { face: 'back', position: [0, 0, -cubeSize / 2 - 0.01], rotation: [0, Math.PI, 0] } // back
    ];

    sticker_positions.forEach(({ face, position, rotation }) => {
        const stickerGeom = new THREE.PlaneGeometry(stickerSize, stickerSize, 32, 32);
        // const stickerMaterial = new THREE.MeshStandardMaterial({ color: color, emissive: 0x000000 });

        const stickerMaterial = new THREE.MeshStandardMaterial({
            // map: baseColorMap,
            color: colorState[face],
            //emissive: 0x999999,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            aoMap: aoMap,
            displacementMap: displacementMap,
            displacementScale: 0.09, // Subtle displacement
            metalnessMap: metallicMap
        });

        const sticker = new THREE.Mesh(stickerGeom, stickerMaterial);
        sticker.position.set(...position);
        sticker.rotation.set(...rotation);
        sticker.userData.face = face;

        sticker.castShadow = true;
        sticker.receiveShadow = true;

        stickerGeom.setAttribute('uv2', new THREE.BufferAttribute(stickerGeom.attributes.uv.array, 2)); // ambient occlusion map

        cube.add(sticker);
    });
	
    cube.rubikPosition = cube.position.clone();
    scene.add(cube);
    cubes.push(cube);
}

// update colors
function updateColors() {
    cubes.forEach(cube => {
        cube.children.forEach(sticker => {
            if (sticker.userData.face) {
                sticker.material.color.setStyle(colorState[sticker.userData.face]);
            }
        });
    });
}

function principalComponent(v) {
	let maxAxis = 'x';
	let max = Math.abs(v.x);
	if (Math.abs(v.y) > max) {
		maxAxis = 'y';
		max = Math.abs(v.y);
	}
	if (Math.abs(v.z) > max) {
		maxAxis = 'z';
		max = Math.abs(v.z);
	}
	return maxAxis;
}

let clickVector, clickFace;

function getRayIntersects(event) {
	// Calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera( pointer, camera );
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(cubes, true);
	return intersects;
}

function calculateFaceCentroid(bufferGeometry, face) {
    const positions = bufferGeometry.attributes.position;
    
    // Retrieve vertices by index
    const vA = new THREE.Vector3().fromBufferAttribute(positions, face.a);
    const vB = new THREE.Vector3().fromBufferAttribute(positions, face.b);
    const vC = new THREE.Vector3().fromBufferAttribute(positions, face.c);

    // Calculate the centroid
    const centroid = new THREE.Vector3(
        (vA.x + vB.x + vC.x) / 3,
        (vA.y + vB.y + vC.y) / 3,
        (vA.z + vB.z + vC.z) / 3
    );

    return centroid;
}

function onCubeMouseDown(event, intersectedObj, faceCentroid) {
	controls.enabled = false;

	if (!isMoving) {
		clickVector = intersectedObj.rubikPosition.clone();

		// Identify which face of the overall cube we clicked on
		if (nearlyEqual(Math.abs(faceCentroid.x), maxExtent)) { clickFace = 'x'; }
		else if (nearlyEqual(Math.abs(faceCentroid.y), maxExtent)) { clickFace = 'y'; }
		else if (nearlyEqual(Math.abs(faceCentroid.z), maxExtent)) { clickFace = 'z'; }
	}  
}

let transitions = {
    'x': {'y': 'z', 'z': 'y'},
    'y': {'x': 'z', 'z': 'x'},
    'z': {'x': 'y', 'y': 'x'}
}

function onCubeMouseUp(event, cube) {
    if (clickVector) {
      let dragVector = cube.rubikPosition.clone();
      dragVector.sub(clickVector);

      // Don't move if the "drag" was too small.
      if (dragVector.length() > cubeSize) {

        let dragVectorOtherAxes = dragVector.clone();
        dragVectorOtherAxes[clickFace] = 0;

        let maxAxis = principalComponent(dragVectorOtherAxes);

        let rotateAxis = transitions[clickFace][maxAxis],
            direction = dragVector[maxAxis] >= 0 ? 1 : -1;
        
        // Reverse direction of some rotations for intuitive control
        if (clickFace == 'z' && rotateAxis == 'x' || 
           clickFace == 'x' && rotateAxis == 'z' ||
           clickFace == 'y' && rotateAxis == 'z') { direction *= -1; }

        if (clickFace == 'x' && clickVector.x > 0 ||
           clickFace == 'y' && clickVector.y < 0 ||
           clickFace == 'z' && clickVector.z < 0) { direction *= -1; }

        startMove(clickVector.clone(), rotateAxis, direction);
        controls.enabled = true;
      } else {
        console.log("Drag me some more please!");
      }
	}
}

let isMoving = false;
let moveAxis, moveDirection;
let rotationSpeed = 0.1;

let pivot = new THREE.Object3D();
let activeGroup = [];

function nearlyEqual(a, b, d) {
	d = d || 0.005;
	return Math.abs(a - b) <= d;
}

// Select the plane of cubes that aligns with clickVector on the given axis
function setActiveGroup(axis) {
	if (clickVector) {
		activeGroup = [];

		cubes.forEach(function(cube) {
			if (nearlyEqual(cube.rubikPosition[axis], clickVector[axis])) { 
				activeGroup.push(cube);
			}
		});
	} else {
		console.log("Nothing to move!");
	}
}

function startMove(vector, axis, direction) {
    clickVector = vector;
    if (clickVector) {
        if (!isMoving) {
            isMoving = true;
            moveAxis = axis;
            moveDirection = direction;

            setActiveGroup(axis);

            pivot.rotation.set(0, 0, 0);
            pivot.updateMatrixWorld();
			scene.add(pivot);

            // Attach each cube in the active group to the pivot
            activeGroup.forEach((cube) => {
                pivot.add(cube);
            });

        } else {
            console.log("Already moving!");
        }
    } else {
        console.log("Nothing to move!");
    }
}

function doMove() {
	// Move a quarter turn then stop
	if (pivot.rotation[moveAxis] >= Math.PI / 2) {
		pivot.rotation[moveAxis] = Math.PI / 2;
		moveComplete();
	} else if (pivot.rotation[moveAxis] <= Math.PI / -2) {
		pivot.rotation[moveAxis] = Math.PI / -2;
		moveComplete();
	} else {
		pivot.rotation[moveAxis] += (moveDirection * rotationSpeed);
	}
}

function moveComplete() {
    isMoving = false;
    moveAxis = moveDirection = undefined;
    clickVector = undefined;

    // Update world matrices
    pivot.updateMatrixWorld();

    // Detach cubes from the pivot and preserve their world position/rotation
    activeGroup.forEach((cube) => {
        // Get the cube's current world position and rotation
        cube.updateMatrixWorld();
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        
        // Decompose the world matrix to get position, rotation, and scale
        cube.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
        
        // Remove from pivot and add back to scene
        pivot.remove(cube);
        scene.add(cube);
        
        // Apply the preserved world transform
        cube.position.copy(worldPosition);
        cube.quaternion.copy(worldQuaternion);
        cube.scale.copy(worldScale);
        
        // Update the rubikPosition property
        cube.rubikPosition = worldPosition;
        
        // Make sure changes take effect
        cube.updateMatrix();
    });

    // Clean up
    scene.remove(pivot);

    if (!isScrambling && isCubeSolved() && !solvedAnimationTriggered) {
        startSolvedAnimation();
    }
}

function isCubeSolved() {
    const faceGroups = {
        right: [],
        left: [],
        top: [],
        bottom: [],
        front: [],
        back: [],
    };

    // Group stickers by face
    cubes.forEach(cube => {
        cube.children.forEach(sticker => {
            const worldPos = sticker.position.clone().applyMatrix4(cube.matrixWorld);

            if (Math.abs(worldPos.x - (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.right.push(sticker.material.color.getHex());
            } else if (Math.abs(worldPos.x + (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.left.push(sticker.material.color.getHex());
            } else if (Math.abs(worldPos.y - (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.top.push(sticker.material.color.getHex());
            } else if (Math.abs(worldPos.y + (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.bottom.push(sticker.material.color.getHex());
            } else if (Math.abs(worldPos.z - (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.front.push(sticker.material.color.getHex());
            } else if (Math.abs(worldPos.z + (cubeSize / 2 + stickerRaise)) < 0.01) {
                faceGroups.back.push(sticker.material.color.getHex());
            }
        });
    });

    // Validate uniformity of each face
    for (const face in faceGroups) {
        const stickers = faceGroups[face];
        if (stickers.length === 0 || !stickers.every(color => color === stickers[0])) {
            return false; // Face is not uniform in color
        }
    }

    return true; // All faces are uniform and cube is solved
}


let solvedAnimationTriggered = false;
let isScrambling = true;

// double check that scramble function only does legal moves
// eventually change scramblecount to something big and make it faster

function scrambleCube() { 
    let scrambleCount = scrambleMoves; // Dynamically set based on difficulty
    let currentScramble = 0;

    function simulateMove() {
        if (currentScramble < scrambleCount) {
            // Simulate clicking on a random cube face (mousedown)
            const randomCube = cubes[Math.floor(Math.random() * cubes.length)];
            
            // Pick a random face position for intersect
            const facePositions = [
                { normal: new THREE.Vector3(1, 0, 0), value: maxExtent },  // Right
                { normal: new THREE.Vector3(-1, 0, 0), value: -maxExtent }, // Left
                { normal: new THREE.Vector3(0, 1, 0), value: maxExtent },  // Top
                { normal: new THREE.Vector3(0, -1, 0), value: -maxExtent }, // Bottom
                { normal: new THREE.Vector3(0, 0, 1), value: maxExtent },  // Front
                { normal: new THREE.Vector3(0, 0, -1), value: -maxExtent }  // Back
            ];
            
            const randomFace = facePositions[Math.floor(Math.random() * facePositions.length)];
            const faceCentroid = new THREE.Vector3()
                .copy(randomFace.normal)
                .multiplyScalar(randomFace.value);

            onCubeMouseDown(null, randomCube, faceCentroid);

            // Simulate dragging to a valid adjacent cube (mouseup)
            setTimeout(() => {
                const samePlane = cubes.filter(cube => {
                    if (clickFace === 'x') {
                        return nearlyEqual(cube.rubikPosition.x, clickVector.x);
                    } else if (clickFace === 'y') {
                        return nearlyEqual(cube.rubikPosition.y, clickVector.y);
                    } else if (clickFace === 'z') {
                        return nearlyEqual(cube.rubikPosition.z, clickVector.z);
                    }
                    return false;
                });

                const validTargets = samePlane.filter(cube => cube !== randomCube);
                const targetCube = validTargets[Math.floor(Math.random() * validTargets.length)];

                if (targetCube) {
                    onCubeMouseUp(null, targetCube);
                    currentScramble++;

                    // Wait for the move to complete before starting the next
                    let interval = setInterval(() => {
                        if (!isMoving) {
                            clearInterval(interval);
                            simulateMove();
                        }
                    }, 100);
                }
            }, 50); // Small delay between mousedown and mouseup
        } else {
            console.log("Scramble complete!");
            isScrambling = false;
            setTimeout(() => {
                gui.show();
            }, 700);
        }
    }

    simulateMove();
}


function startSolvedAnimation() {
    gui.hide();
    let startTime = null;
    const duration = 1000; 
    const targetRotation = Math.PI * 2; // Full 360° rotation

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function to mimic "power1.inOut"
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        scene.rotation.y = targetRotation * eased;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete
            startDissolveEffect();
            console.log("Congratulations! You solved the cube!");
            solvedAnimationTriggered = true;
        }
    }

    requestAnimationFrame(animate);
}

// particle explosion code

let particles = [];
let particleSystem;

// Create particle system for the celebration effect
function createParticleSystem() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const particleCount = 2000;

    // Create random positions and colors for particles
    for (let i = 0; i < particleCount; i++) {
        // Start all particles from center
        positions.push(0, 0, 0);
        
        // Random colors matching cube colors
        const colorChoice = faceColors[Math.floor(Math.random() * faceColors.length)];
        const color = new THREE.Color(colorChoice);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        opacity: 1,
        transparent: true
    });

    particleSystem = new THREE.Points(geometry, material);
    particleSystem.visible = false; // Hide initially
    scene.add(particleSystem);

    // Initialize particle velocities
    particles = [];
    const positions3 = geometry.attributes.position.array;
    
    for (let i = 0; i < particleCount; i++) {
        // Random spherical coordinates for direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 0.1 + Math.random() * 0.1;

        particles.push({
            velocity: new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            ),
            index: i * 3,
            life: 1.0, // Life value for fade out
            positions: positions3
        });
    }
}

function updateParticles() {
    if (!particleSystem || !particleSystem.visible) return;

    const positions = particleSystem.geometry.attributes.position.array;
    
    let allParticlesDead = true;

    particles.forEach(particle => {
        if (particle.life > 0) {
            allParticlesDead = false;
            // Update position based on velocity
            positions[particle.index] += particle.velocity.x;
            positions[particle.index + 1] += particle.velocity.y;
            positions[particle.index + 2] += particle.velocity.z;

            // Add gravity effect
            particle.velocity.y -= 0.001;

            // Reduce life/opacity
            particle.life -= 0.003;

            // Update particle opacity based on life
            particleSystem.material.opacity = Math.max(0, particle.life);
        }
    });

    if (allParticlesDead) {
        particleSystem.visible = false;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
}

function triggerParticleExplosion() {
    // Reset particle positions to slightly randomized starting positions
    const positions = particleSystem.geometry.attributes.position.array;
    particles.forEach(particle => {
        // Start particles in a small sphere around center for more natural burst
        const offset = 0.5;
        positions[particle.index] = (Math.random() - 0.5) * offset;
        positions[particle.index + 1] = (Math.random() - 0.5) * offset;
        positions[particle.index + 2] = (Math.random() - 0.5) * offset;
        particle.life = 1.0;
    });
    particleSystem.geometry.attributes.position.needsUpdate = true;
    
    particleSystem.visible = true;
    particleSystem.material.opacity = 1;
}

let isDissolving = false;
const DISSOLVE_DURATION = 3000;
let dissolveStartTime;

function startDissolveEffect() {
    isDissolving = true;
    dissolveStartTime = Date.now();
    triggerParticleExplosion();
    
    // Convert each cube into many smaller cubes
    cubes.forEach(cube => {
        const worldPosition = new THREE.Vector3();
        cube.getWorldPosition(worldPosition);
        
        // Create 27 smaller cubes (3x3x3) for each cube piece
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const smallCubeSize = cubeSize / 3;
                    const geometry = new THREE.BoxGeometry(smallCubeSize, smallCubeSize, smallCubeSize);
                    
                    // Sample the color from the nearest sticker or use cube color
                    const material = new THREE.MeshBasicMaterial({
                        color: getColorForPosition(cube, x, y, z),
                        transparent: true
                    });
                    
                    const smallCube = new THREE.Mesh(geometry, material);
                    
                    // Position relative to the original cube center
                    smallCube.position.set(
                        worldPosition.x + x * smallCubeSize,
                        worldPosition.y + y * smallCubeSize,
                        worldPosition.z + z * smallCubeSize
                    );
                    
                    // Add random velocity for dissolution
                    smallCube.velocity = new THREE.Vector3(
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1
                    );
                    
                    // Add rotation velocity
                    smallCube.rotationVelocity = new THREE.Vector3(
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.1
                    );
                    
                    scene.add(smallCube);
                    cube.dissolveParticles = cube.dissolveParticles || [];
                    cube.dissolveParticles.push(smallCube);
                }
            }
        }
        
        // Hide original cube
        cube.visible = false;
    });
}

function getColorForPosition(cube, x, y, z) {
    // Find the closest sticker based on position
    let closestColor = cube.material.color;
    let minDistance = Infinity;
    
    cube.children.forEach(sticker => {
        const stickerPos = sticker.position.clone();
        const checkPos = new THREE.Vector3(x, y, z).multiplyScalar(cubeSize / 3);
        const distance = stickerPos.distanceTo(checkPos);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = sticker.material.color;
        }
    });
    
    return closestColor;
}

function updateDissolveEffect() {
    if (!isDissolving) return;
    
    const elapsed = Date.now() - dissolveStartTime;
    const progress = Math.min(elapsed / DISSOLVE_DURATION, 1);
    
    cubes.forEach(cube => {
        if (!cube.dissolveParticles) return;
        
        cube.dissolveParticles.forEach(particle => {
            // Update position
            particle.position.add(particle.velocity);
            
            // Add some gravity and spread
            particle.velocity.y -= 0.001; // gravity
            particle.velocity.multiplyScalar(1.01); // spread
            
            // Update rotation
            particle.rotation.x += particle.rotationVelocity.x;
            particle.rotation.y += particle.rotationVelocity.y;
            particle.rotation.z += particle.rotationVelocity.z;
            
            // Update opacity
            particle.material.opacity = 1 - progress;
            
            // Scale down
            const scale = 1 - progress * 0.5;
            particle.scale.set(scale, scale, scale);
        });
    });
    
    if (progress >= 1) {
        isDissolving = false;
        // Clean up dissolve particles
        cubes.forEach(cube => {
            if (cube.dissolveParticles) {
                cube.dissolveParticles.forEach(particle => {
                    scene.remove(particle);
                });
                cube.dissolveParticles = [];
            }
        });

        // Show congratulations message
        const congrats = document.createElement('div');
        congrats.className = 'congrats-message';
        congrats.innerHTML = `
            <h2>winner winner chicken dinner</h2>
            <p>congrats on solving our rubik's cube.</p>
            <button class="restart-button">let's go again.</button>
        `;
        document.body.appendChild(congrats);

        // Add click handler to restart button
        const restartButton = congrats.querySelector('.restart-button');
        restartButton.addEventListener('click', () => {
            congrats.style.opacity = '0';
            setTimeout(() => {
                congrats.remove();
                resetGame();
            }, 500);
        });
        
        // Trigger fade in
        setTimeout(() => {
            congrats.classList.add('fade-in');
        }, 10);
    }
}

function startGame(dimension) {
    console.log(`Starting game with ${dimension}x${dimension} cube`);

    // Clear any existing cubes in the scene
    cubes.forEach(cube => scene.remove(cube));
    cubes = [];

    // Create the Rubik's cube for the selected dimension
    createRubiksCube(dimension);

    // Scramble the cube after creating it
    scrambleCube();

    // Adjust camera and lighting for larger cubes (optional)
    adjustCameraAndLighting(dimension);

    console.log(`Game setup complete for ${dimension}x${dimension} cube`);
}


const clock = new THREE.Clock();
let mixer;
let throwAction;
let fbx;
const loader = new FBXLoader();
loader.setPath('./assets/');

let isDetached = true;
const attachTime = 1.5;
const detachTime = 3.5;

const initialVelocity = new THREE.Vector3(0, 5, 87);
const gravity = new THREE.Vector3(0, -15, 0); // changed the gravity a bit

let originPositions = [];

function resetGame() {
    // Reset game state variables
    isMoving = false;
    moveAxis = undefined;
    moveDirection = undefined;
    clickVector = undefined;
    solvedAnimationTriggered = false;
    isScrambling = true;
    isDissolving = false;
    isDetached = true;

    particles = [];
    createParticleSystem();

    // Clear cubes array
    cubes = [];
    originPositions = [];

    // Reset scene rotation
    scene.rotation.set(0, 0, 0);

    // Reset camera position
    camera.position.set(60, 50, -270);
    controls.target.set(0, 42, -316);
    camera.lookAt(0, 42, -316);
    controls.update();

    if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
        mixer = null;
    }

    if (throwAction) {
        throwAction.reset();
        throwAction = null;
    }

    // Reset the clock
    clock.stop();
    clock.start();

    // Remove old animated character from the scene
    if (fbx) {
        scene.remove(fbx);
        fbx = null;
    }

    // Start new scramble
    introAnimation();
}

function introAnimation(selectedDimension = 3) {
    loader.load('Sporty_Granny.fbx', (loadedFbx) => {
        fbx = loadedFbx;
        fbx.scale.setScalar(0.35);
        fbx.position.set(10, 4.5, -345);

        const spotLight = new THREE.SpotLight(0xffffff, 1.5);
        spotLight.position.set(10, 10, -340);
        spotLight.target.position.set(10, 4.5, -345);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(10, 5, -340);

        scene.add(spotLight);
        scene.add(spotLight.target);
        scene.add(frontLight);

        // Dynamically generate cubes for the selected dimension
        const offset = (selectedDimension - 1) / 2; // Center the cubes
        for (let i = 0; i < selectedDimension; i++) {
            for (let j = 0; j < selectedDimension; j++) {
                for (let k = 0; k < selectedDimension; k++) {
                    let x = (i - offset) * increment;
                    let y = (j - offset) * increment;
                    let z = (k - offset) * increment;
                    newCube(x, y + 2.5, z - 323); // Adjust initial position
                    originPositions.push({ x, y, z });
                }
            }
        }

        const animLoader = new FBXLoader();
        animLoader.setPath('./assets/');
        animLoader.load('Throw_Object.fbx', (anim) => {
            fbx.visible = false;

            mixer = new THREE.AnimationMixer(fbx);
            throwAction = mixer.clipAction(anim.animations[0]);
            throwAction.reset();
            throwAction.setLoop(THREE.LoopOnce);
            throwAction.clampWhenFinished = true;

            mixer.update(0);

            setTimeout(() => {
                fbx.visible = true;
                throwAction.play();
            }, 20);

            let rightHandBone;
            fbx.traverse((bone) => {
                if (bone.isBone && bone.name === 'mixamorigRightHand') {
                    rightHandBone = bone;
                }
            });

            const offset = new THREE.Vector3(0, -5, 0);

            let detachPosition = new THREE.Vector3();
            let detachTimeElapsed = 0;

            let stopExecution = false;

            function update() {
                if (stopExecution) return;

                const delta = clock.getDelta();
                mixer.update(delta);

                if (rightHandBone && !isDetached) {
                    const handPosition = rightHandBone.getWorldPosition(new THREE.Vector3());
                    cubes.forEach((cube, index) => {
                        cube.position.copy(handPosition).add(originPositions[index]).add(offset);
                        cube.rubikPosition = cube.position.clone();
                    });

                    if (throwAction.time >= detachTime) {
                        isDetached = true;
                        detachPosition.copy(rightHandBone.getWorldPosition(new THREE.Vector3()));
                        detachTimeElapsed = 0;
                    }
                } else if (isDetached) {
                    if (throwAction.time >= attachTime && throwAction.time < detachTime) {
                        isDetached = false;
                    } else if (throwAction.time >= detachTime) {
                        detachTimeElapsed += delta;
                        const time = detachTimeElapsed;

                        const position = new THREE.Vector3().copy(detachPosition)
                            .add(initialVelocity.clone().multiplyScalar(time))
                            .add(gravity.clone().multiplyScalar(0.5 * time * time))
                            .add(offset);

                        if (position.y <= 0) {
                            cubes.forEach((cube, index) => {
                                cube.position.set(0, 0, 0).add(originPositions[index]);
                                cube.rotation.set(0, 0, 0);
                                cube.rubikPosition = cube.position.clone();
                            });

                            camera.position.set(5.5, 5.5, 11);
                            controls.target.set(0, 0, 0);
                            camera.lookAt(0, 0, 0);
                            controls.enabled = true;

                            stopExecution = true;
                            scene.remove(fbx);
                            scene.remove(spotLight);
                            scene.remove(spotLight.target);
                            scene.remove(frontLight);
                            setTimeout(scrambleCube, 1200);
                            return;
                        } else {
                            cubes.forEach((cube, index) => {
                                cube.position.copy(position).add(originPositions[index]);
                                cube.rotation.x = 3.0 * Math.PI / 3.5 * time;
                                cube.rotation.y = 3.0 * Math.PI / 3.5 * time;
                                cube.rubikPosition = cube.position.clone();
                            });

                            const cameraOffset = new THREE.Vector3(60, 8, 47);
                            cameraOffset.divideScalar(1 + time);
                            const timedShift = new THREE.Vector3(0, 2, -2);
                            cameraOffset.add(timedShift.multiplyScalar(time));

                            const cubeCenter = new THREE.Vector3();
                            cubes.forEach((cube) => {
                                cubeCenter.add(cube.position);
                            });
                            cubeCenter.divideScalar(cubes.length);

                            camera.position.copy(position).add(cameraOffset);
                            controls.target.copy(cubeCenter);
                            camera.lookAt(cubeCenter);

                            controls.enabled = false;
                        }
                    }
                }

                if (!stopExecution) {
                    requestAnimationFrame(update);
                }
            }

            update();
        });

        scene.add(fbx);
    });
}


function animate() {
    if (controls.enabled) {
        controls.update();
    }

	if (isMoving) {
		doMove();
	} 

    if (isDissolving) {
        updateDissolveEffect();
    }

    updateParticles();

	renderer.render( scene, camera );
}

document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById('menu');
    const difficultyButtons = document.querySelectorAll('.difficulty-button');
    const dimensionButtons = document.querySelectorAll('.dimension-button');
    let selectedDimension = 3; // Default to 3x3

    // Handle dimension button click
    dimensionButtons.forEach(button => {
        button.addEventListener('click', () => {
            dimensionButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedDimension = parseInt(button.dataset.dimension, 10);
            console.log(`Selected dimension: ${selectedDimension}`);
        });
    });

    // Handle difficulty button click
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const difficulty = button.dataset.difficulty;
            scrambleMoves = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 6 : 30;

            console.log(`Scramble Moves set to: ${scrambleMoves}`);
            menu.style.display = 'none';

            // Start the game with the selected dimension
            introAnimation(selectedDimension); // Pass the selected dimension
        });
    });
});


function createRubiksCube(dimension) {
    cubes = []; // Clear existing cubes
    originPositions = []; // Reset origin positions

    const offset = (dimension - 1) / 2; // Center the cube

    for (let i = 0; i < dimension; i++) {
        for (let j = 0; j < dimension; j++) {
            for (let k = 0; k < dimension; k++) {
                const x = (i - offset) * increment;
                const y = (j - offset) * increment;
                const z = (k - offset) * increment;
                newCube(x, y, z); // Create each cube piece
                originPositions.push({ x, y, z }); // Store initial positions
            }
        }
    }
}
