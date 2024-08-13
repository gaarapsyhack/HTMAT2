// game.js
import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/FBXLoader.js';

// Ajustar el tamaño de la ventana al cambiar su tamaño
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Escena, cámara y renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Color de fondo azul cielo

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Añadir una luz ambiental suave
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Añadir una luz direccional para sombras
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

const loader = new FBXLoader();
const url = '3d/mapa3.fbx'; // Ruta al archivo FBX

loader.load(url, function (object) {
    scene.add(object);
    object.position.set(0, 0, 1); // Ajusta la posición del modelo si es necesario
    object.scale.set(1, 1, 1); // Ajusta la escala del modelo si es necesario
}, undefined, function (error) {
    console.error('An error happened:', error);
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Habilitar sombras
document.body.appendChild(renderer.domElement);

// Crear un plano (suelo) con una textura
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load('https://threejsfundamentals.org/threejs/resources/images/checker.png');
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(20, 20);

const floorGeometry = new THREE.PlaneGeometry(200, 200);
const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = - Math.PI / 2;
floor.receiveShadow = true; // Recibir sombras
scene.add(floor);

// Añadir algunos cubos para interactuar con el entorno
const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

for (let i = 0; i < 20; i++) {
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(
        (Math.random() - 0.5) * 100,
        2,
        (Math.random() - 0.5) * 100
    );
    box.castShadow = true; // Proyectar sombras
    box.receiveShadow = true;
    scene.add(box);
}

// Controles de primera persona
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Instrucciones para el usuario
const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '50%';
instructions.style.width = '100%';
instructions.style.textAlign = 'center';
instructions.style.fontSize = '24px';
instructions.style.color = 'white';
instructions.style.fontFamily = 'Arial';
instructions.style.cursor = 'pointer';
instructions.innerHTML = 'Haz clic para jugar';
document.body.appendChild(instructions);

instructions.addEventListener('click', function () {
    controls.lock();
});

controls.addEventListener('lock', function () {
    instructions.style.display = 'none';
});

controls.addEventListener('unlock', function () {
    instructions.style.display = '';
});

// Movimiento básico
const moveSpeed = 400.0; // unidades por segundo
const clock = new THREE.Clock();

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const keysPressed = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

// Teclas de movimiento
const onKeyDown = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keysPressed.forward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keysPressed.left = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keysPressed.backward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keysPressed.right = true;
            break;
    }
};

const onKeyUp = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keysPressed.forward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keysPressed.left = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keysPressed.backward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keysPressed.right = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Posicionar la cámara inicial un poco por encima del suelo
camera.position.y = 8;

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (controls.isLocked === true) {
        // Reducir velocidad gradualmente (simulación de fricción)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(keysPressed.forward) - Number(keysPressed.backward);
        direction.x = Number(keysPressed.right) - Number(keysPressed.left);
        direction.normalize(); // Asegurarse de que la dirección no sea demasiado rápida

        if (keysPressed.forward || keysPressed.backward) velocity.z -= direction.z * moveSpeed * delta;
        if (keysPressed.left || keysPressed.right) velocity.x -= direction.x * moveSpeed * delta;

        controls.moveRight(- velocity.x * delta);
        controls.moveForward(- velocity.z * delta);

        // Evitar que el usuario caiga
        controls.getObject().position.y = 10; // Altura fija sobre el suelo
    }

    renderer.render(scene, camera);
}

animate();
