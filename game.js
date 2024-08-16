import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/FBXLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@0.20.0';
import { ConvexGeometry } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/geometries/ConvexGeometry.js';

let mapMeshes = [];
const playerHeight = 4;
const playerRadius = 0.5;
let convexHull = new THREE.Mesh();

// Configurar el mundo de Cannon.js
const world = new CANNON.World();
world.gravity.set(0, -9.8, 0);  // Gravedad hacia abajo

// Crear el cuerpo del jugador en Cannon.js
const playerShape = new CANNON.Sphere(playerRadius);
const playerBody = new CANNON.Body({
    mass: 75,  // Masa del jugador
    position: new CANNON.Vec3(0, 40, 0),  // Posición inicial
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

// Crear la malla visual en Three.js para el jugador
const playerGeometry = new THREE.SphereGeometry(playerRadius, 32, 32); // Puedes ajustar el número de segmentos para mejorar la apariencia
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Color rojo para el jugador
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(playerMesh);

const planeGeometry = new THREE.PlaneGeometry(25, 25)
const texture = new THREE.TextureLoader().load('img/grid.png')
const plane = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshPhongMaterial({ map: texture })
)
plane.rotateX(-Math.PI / 2)
plane.position.y = -1
plane.receiveShadow = true
scene.add(plane)

const planeShape = new CANNON.Plane()
const planeBody = new CANNON.Body({ mass: 0 })
planeBody.addShape(planeShape)
planeBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(1, 0, 0),
    -Math.PI / 2
)
planeBody.position.y = plane.position.y
world.addBody(planeBody)
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
// Función para convertir geometría de Three.js a Trimesh de Cannon.js
function CreateTrimesh(geometry) {
    let vertices
    if (geometry.index === null) {
        vertices = geometry.attributes.position.array
    } else {
        vertices = geometry.clone().toNonIndexed().attributes.position.array
    }
    const indices = Object.keys(vertices).map(Number)
    return new CANNON.Trimesh(vertices, indices)
}


loader.load(url, (object) => {
    object.position.set(-15, -20, -20);
    object.scale.set(0.5, 0.5, 0.5);

    scene.add(object);
    console.log("object pos:", object.position);
    object.updateMatrixWorld(true);

    object.traverse(function (child) {
        
        //console.log("childpos:", child.position);
        if (child instanceof THREE.Mesh) {

            child.updateMatrixWorld();
            child.geometry.attributes.position.needsUpdate = true;
            const box = new THREE.Box3().setFromObject(child);
            const size = new THREE.Vector3();
            box.getSize(size);
            const c = new THREE.Vector3();
            child.getWorldPosition(c);
            const nodeQuaterion = new THREE.Quaternion();
            child.getWorldQuaternion(nodeQuaterion);

              // Calculate relative scale based on the parent's scale
              const relativeScale = new THREE.Vector3();
              relativeScale.copy(object.scale);  // Parent scale
              relativeScale.multiply(child.scale); // Relative to child scale
  
            console.log("child scale:", child.scale);
            //scene.add(child);
                const position = child.geometry.attributes.position.array;
                const points = [];
                for (let i = 0; i < position.length; i += 3) {
                    // Apply the relative scale
                    points.push(new THREE.Vector3(
                        position[i] * relativeScale.x,
                        position[i + 1] * relativeScale.y,
                        position[i + 2] * relativeScale.z
                    ));
                }
                const convexGeometry = new ConvexGeometry(points);
                //convexHull = new THREE.Mesh(convexGeometry, new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }));
                //child.add(convexHull);

                const shape = CreateTrimesh(convexGeometry);
                const body = new CANNON.Body({ mass: 0 });
                body.addShape(shape);

                body.position.copy(c);
                body.quaternion.copy(nodeQuaterion);
                // Aplicar la escala correcta en este contexto
            
                world.addBody(body);

                    // Visualizar el Trimesh
    const trimeshGeometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < shape.vertices.length; i += 3) {
        vertices.push(shape.vertices[i], shape.vertices[i + 1], shape.vertices[i + 2]);
    }
    trimeshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const trimeshMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe : true });
    const trimeshMesh = new THREE.Mesh(trimeshGeometry, trimeshMaterial);

    trimeshMesh.position.copy(body.position);
    trimeshMesh.quaternion.copy(body.quaternion);
    scene.add(trimeshMesh);
    }
    });
    //scene.add(object);
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
    const delta = Math.min(clock.getDelta(), 0.1)

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
        world.step(delta);

        playerMesh.position.copy(playerBody.position);

        // Sincronizar la posición del jugador de Three.js con la de Cannon.js
        controls.getObject().position.copy(playerBody.position);
        camera.position.y = playerBody.position.y + playerHeight;
    }

    renderer.render(scene, camera);
}

animate();
