import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/FBXLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@0.20.0';

let mapMeshes = [];
const playerHeight = 1.8;
const playerRadius = 0.5;

// Configurar el mundo de Cannon.js
const world = new CANNON.World();
world.gravity.set(0, -9.8, 0);  // Gravedad hacia abajo

// Crear el cuerpo del jugador en Cannon.js
const playerShape = new CANNON.Sphere(playerRadius);
const playerBody = new CANNON.Body({
    mass: 75,  // Masa del jugador
    position: new CANNON.Vec3(0, 15, 0),  // Posición inicial
    shape: playerShape,
    material: new CANNON.Material({
        friction: 0.0,
        restitution: 0.0
    })
});
world.addBody(playerBody);

// Escena, cámara y renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Añadir luces
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Cargar el modelo FBX
const loader = new FBXLoader();
const url = '3d/mapa6.fbx';

loader.load(url, (object) => {
    object.position.set(-15, -40, -20);
    object.scale.set(0.5, 0.5, 0.5);
    object.updateMatrixWorld(true);

    object.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            child.geometry.computeBoundingBox();
            const boundingBox = child.geometry.boundingBox.clone();
            boundingBox.applyMatrix4(child.matrixWorld);
            mapMeshes.push(child);

            // Crear un cuerpo de Cannon.js para cada malla
            const boxSize = boundingBox.getSize(new THREE.Vector3());
            const boxShape = new CANNON.Box(new CANNON.Vec3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2));
            const boxBody = new CANNON.Body({
                mass: 0,  // Objeto estático
                position: new CANNON.Vec3(boundingBox.min.x + boxSize.x / 2, boundingBox.min.y + boxSize.y / 2, boundingBox.min.z + boxSize.z / 2),
                shape: boxShape
            });
            world.addBody(boxBody);
        }
    });

    scene.add(object);
}, undefined, function (error) {
    console.error('An error happened:', error);
});

// Controles de primera persona
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

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
const moveSpeed = 20.0;
const clock = new THREE.Clock();
const keysPressed = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keysPressed.forward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keysPressed.left = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keysPressed.backward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keysPressed.right = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            keysPressed.forward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keysPressed.left = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keysPressed.backward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keysPressed.right = false;
            break;
    }
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (controls.isLocked === true) {
        const direction = new THREE.Vector3();
        const velocity = new THREE.Vector3();

        // Obtener la dirección en la que la cámara está mirando
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; // Ignorar el componente Y para que el jugador no se mueva hacia arriba o abajo
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize(); // Vector a la derecha de la cámara

        // Calcular la dirección del movimiento basado en las teclas presionadas
        direction.z = Number(keysPressed.forward) - Number(keysPressed.backward);
        direction.x = Number(keysPressed.right) - Number(keysPressed.left);

        // Combinar la dirección del movimiento con la dirección en la que mira la cámara
        velocity.add(forward.clone().multiplyScalar(direction.z));
        velocity.add(right.clone().multiplyScalar(direction.x));
        velocity.normalize().multiplyScalar(moveSpeed); // Ajustar velocidad

        // Aplicar velocidad al cuerpo del jugador en Cannon.js
        playerBody.velocity.x = velocity.x;
        playerBody.velocity.z = velocity.z;

        // Actualizar el mundo de Cannon.js
        world.step(1 / 60, delta, 3);

        // Sincronizar la posición del jugador de Three.js con la de Cannon.js
        controls.getObject().position.copy(playerBody.position);

        // Mantener la cámara a una altura constante sobre el jugador
        const cameraHeight = playerBody.position.y + playerHeight / 2;
        camera.position.y = cameraHeight;
    }

    renderer.render(scene, camera);
}


animate();
