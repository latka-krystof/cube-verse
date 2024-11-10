import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 5, 10);
controls.target.set(0, 5, 0);

const face_colors = [0xa240e4, 0xed5b2c, 0x41a9f7, 0xffffff, 0x3eb8cd, 0xb08d57]
const cube_size = 2;
const sticker_size = 1.8;
const spacing = 0.05;
const increment = cube_size + spacing;

let cubes = [];

function newCube(x, y, z) {
    const cube_geom = new THREE.BoxGeometry(cube_size, cube_size, cube_size);
    const cube_material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000) });
    const cube = new THREE.Mesh(cube_geom, cube_material);
    cube.position.set(x, y, z);
    cube.rubikPosition = cube.position.clone();
    scene.add(cube);

    // Create and position stickers on each face
    const sticker_positions = [
        { color: face_colors[0], position: [cube_size / 2 + 0.01, 0, 0], rotation: [0, Math.PI / 2, 0] }, // Right
        { color: face_colors[1], position: [-cube_size / 2 - 0.01, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // Left
        { color: face_colors[2], position: [0, cube_size / 2 + 0.01, 0], rotation: [-Math.PI / 2, 0, 0] }, // Top
        { color: face_colors[3], position: [0, -cube_size / 2 - 0.01, 0], rotation: [Math.PI / 2, 0, 0] }, // Bottom
        { color: face_colors[4], position: [0, 0, cube_size / 2 + 0.01], rotation: [0, 0, 0] }, // Front
        { color: face_colors[5], position: [0, 0, -cube_size / 2 - 0.01], rotation: [0, Math.PI, 0] }, // Back
    ];

    sticker_positions.forEach(({ color, position, rotation }) => {
        const sticker_geom = new THREE.PlaneGeometry(sticker_size, sticker_size);
        const sticker_material = new THREE.MeshBasicMaterial({ color: color });
        const sticker = new THREE.Mesh(sticker_geom, sticker_material);
        sticker.position.set(...position);
        sticker.rotation.set(...rotation);
        cube.add(sticker);
    });

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

function animate() {
	controls.update();
	renderer.render( scene, camera );
}