import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 5, 10);
controls.target.set(0, 5, 0);
controls.enabled = true;

renderer.setAnimationLoop( animate );

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const faceColors = [0xa240e4, 0xed5b2c, 0x41a9f7, 0xffffff, 0x3eb8cd, 0xb08d57]
const cubeSize = 2;
const stickerSize = 1.8;
const stickerRaise = 0.01;
const spacing = 0.05;
const increment = cubeSize + spacing;
const maxExtent = (cubeSize * 3 + spacing * 2 + 2 * stickerRaise) / 2;

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

function newCube(x, y, z) {
    const cubeGeom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000) });
    const cube = new THREE.Mesh(cubeGeom, cubeMaterial);
    cube.position.set(x, y, z);

    // Create and position stickers on each face
    const sticker_positions = [
        { color: faceColors[0], position: [cubeSize / 2 + 0.01, 0, 0], rotation: [0, Math.PI / 2, 0] }, // Right
        { color: faceColors[1], position: [-cubeSize / 2 - 0.01, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // Left
        { color: faceColors[2], position: [0, cubeSize / 2 + 0.01, 0], rotation: [-Math.PI / 2, 0, 0] }, // Top
        { color: faceColors[3], position: [0, -cubeSize / 2 - 0.01, 0], rotation: [Math.PI / 2, 0, 0] }, // Bottom
        { color: faceColors[4], position: [0, 0, cubeSize / 2 + 0.01], rotation: [0, 0, 0] }, // Front
        { color: faceColors[5], position: [0, 0, -cubeSize / 2 - 0.01], rotation: [0, Math.PI, 0] }, // Back
    ];

    sticker_positions.forEach(({ color, position, rotation }) => {
        const stickerGeom = new THREE.PlaneGeometry(stickerSize, stickerSize);
        const stickerMaterial = new THREE.MeshBasicMaterial({ color: color });
        const sticker = new THREE.Mesh(stickerGeom, stickerMaterial);
        sticker.position.set(...position);
        sticker.rotation.set(...rotation);
        cube.add(sticker);
    });
	
    cube.rubikPosition = cube.position.clone();
    scene.add(cube);
    cubes.push(cube);
}

for (let i = 0; i < 3; i++) {
	for (let j = 0; j < 3; j++) {
		for (let k = 0; k < 3; k++) {
			let x = (i - 1) * increment;
			let y = (j - 1) * increment;
			let z = (k - 1) * increment;
			newCube(x, y, z);
		}
	}
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
let rotationSpeed = 0.05;

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
}

function animate() {
    if (controls.enabled) {
        controls.update();
    }

	if (isMoving) {
		doMove();
	} 
	renderer.render( scene, camera );
}