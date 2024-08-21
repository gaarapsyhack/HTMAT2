import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/FBXLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@0.20.0';
import { ConvexGeometry } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/geometries/ConvexGeometry.js';


let mapMeshes = [];
const playerHeight = 15;
const playerRadius = 5;
let convexHull = new THREE.Mesh();
let mesh;
// Configurar el mundo de Cannon.js
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);  // Gravedad hacia abajo

// Crear el cuerpo del jugador en Cannon.js
const playerShape = new CANNON.Sphere(playerRadius);
const playerBody = new CANNON.Body({
    mass: 75,  // Masa del jugador
    position: new CANNON.Vec3(0, 20, 0),  // Posición inicial
    shape: playerShape,
    material: new CANNON.Material({
        friction: 1,
        restitution: 0.0
    })
});
world.addBody(playerBody);



const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0); // Centro de la pantalla
let selectedObject = null;
let isDragging = false;

let grabbedObject = null;
let grabOffset = new THREE.Vector3();
let maxGrabDistance = 1000; // Distancia máxima para agarrar un objeto
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
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);


// Crear un punto en el centro de la pantalla usando Three.js
const crosshairGeometry = new THREE.SphereGeometry(0.009, 32, 32); // Pequeña esfera
const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Color blanco
const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);

// Posicionar el crosshair delante de la cámara
crosshair.position.set(0, 0, -2);
camera.add(crosshair);
scene.add(camera);  // Asegúrate de agregar la cámara a la escena

// Cargar el modelo FBX
const loader = new FBXLoader();
let url = '3d/mapa11.fbx';
// Función para convertir geometría de Three.js a Trimesh de Cannon.js
let physicsObjects = [];  // Array para almacenar la relación entre cuerpos y mallas

function addPhysicsObject(mesh, body) {
    physicsObjects.push({ mesh, body });
}


function CreateTrimesh(geometry) {
    let vertices;
    if (geometry.index === null) {
        vertices = geometry.attributes.position.array;
    } else {
        const nonIndexedGeometry = geometry.clone().toNonIndexed();
        vertices = nonIndexedGeometry.attributes.position.array;
    }
    const indices = Array.from({ length: vertices.length / 3 }, (_, i) => i);

    return new CANNON.Trimesh(vertices, indices);
}

loader.load(url, (object) => {
    object.position.set(-15, -20, -20);
    object.scale.set(0.5, 0.5, 0.5);

    scene.add(object);
    console.log("object pos:", object.position);
    object.updateMatrixWorld(true);

    object.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            child.updateMatrixWorld();
            child.geometry.attributes.position.needsUpdate = true;
            const box = new THREE.Box3().setFromObject(child);
            const size = new THREE.Vector3();
            box.getSize(size);
            const c = new THREE.Vector3();
            child.getWorldPosition(c);
            const nodeQuaternion = new THREE.Quaternion();
            child.getWorldQuaternion(nodeQuaternion);

            // Calculate relative scale based on the parent's scale
            const relativeScale = new THREE.Vector3();
            relativeScale.copy(object.scale);  // Parent scale
            relativeScale.multiply(child.scale); // Relative to child scale

            console.log("child scale:", child.scale);

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
            const shape = CreateTrimesh(convexGeometry);
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(shape);

            body.position.copy(c);
            body.quaternion.copy(nodeQuaternion);
            body.restitution = 0.0;
            body.friction = 1;
            
            world.addBody(body);

            // Create a mesh for the convex geometry to visualize
            const mesh = new THREE.Mesh(convexGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
            mesh.position.copy(c);
            mesh.quaternion.copy(nodeQuaternion);
            scene.add(mesh);

        }
    });
}, undefined, function (error) {
    console.error('An error happened:', error);
});

const spheres = [];  // Array para almacenar las esferas visibles

loader.load('piezas/pieza3.fbx', (object) => {
    object.position.set(25, 10, 0);
    object.scale.set(0.03, 0.03, 0.03);
    object.updateMatrixWorld(true);

    object.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            child.updateMatrixWorld(true);

            const globalPosition = new THREE.Vector3();
            const globalQuaternion = new THREE.Quaternion();
            const globalScale = new THREE.Vector3();

            child.getWorldPosition(globalPosition);
            child.getWorldQuaternion(globalQuaternion);
            child.getWorldScale(globalScale);

            // Calcular la Bounding Sphere
            const boundingSphere = new THREE.Sphere();
            child.geometry.computeBoundingSphere();
            boundingSphere.copy(child.geometry.boundingSphere);

            // Escalar el radio de la Bounding Sphere según la escala global
            const radius = boundingSphere.radius * globalScale.length() / Math.sqrt(3) * 0.80;

            // Crear la esfera en CANNON
            const sphereShape = new CANNON.Sphere(radius);
            const body = new CANNON.Body({ 
                mass: 1, 
                angularDamping: 0.5,
                linearDamping: 0.5,
                material: new CANNON.Material({
                    friction: 1,  // Fricción moderada
                    restitution: 0.1  // Baja restitución para evitar rebotes exagerados
                })
            });

            // Añadir la esfera al cuerpo físico
            body.addShape(sphereShape);

            body.position.copy(globalPosition);
            body.quaternion.copy(globalQuaternion);
            body.fixedRotation = true;  
            //body.angularDamping = 1.0;

            world.addBody(body);

            // Crear una malla para la esfera en Three.js
            const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
            const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

            // Posicionar la esfera en la escena
            sphereMesh.position.copy(globalPosition);
            scene.add(sphereMesh);

            // Añadir la esfera al array de esferas visibles para actualizar más tarde
            spheres.push({ mesh: sphereMesh, offset: new THREE.Vector3(), body });

            // Añadir la malla del objeto a la escena
            mesh = child;
            mesh.position.copy(globalPosition);
            mesh.quaternion.copy(globalQuaternion);
            mesh.scale.copy(globalScale);
            scene.add(mesh);

            addPhysicsObject(mesh, body);
        }
    });
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

const noCollisionGroup = 0x00000000;  // Un grupo sin colisión

document.addEventListener('mousedown', (event) => {
    if (controls.isLocked && !isDragging) {
        isDragging = true;

        // Detectar si se está apuntando a un objeto que puede ser agarrado
        raycaster.setFromCamera(pointer, camera);
        const intersectableMeshes = physicsObjects.map(obj => obj.mesh);
        const intersects = raycaster.intersectObjects(intersectableMeshes, true);

        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            const physicsObject = physicsObjects.find(obj => obj.mesh === intersected);

            if (physicsObject) {
                grabbedObject = physicsObject;
                
                grabbedObject.body.collisionFilterGroup = noCollisionGroup;
                grabbedObject.body.collisionFilterMask = noCollisionGroup;

                grabOffset.copy(grabbedObject.mesh.position).sub(camera.position);

                // Limitar la distancia para evitar que agarre objetos muy lejanos
                if (grabOffset.length() > maxGrabDistance) {
                    console.log("El objeto está demasiado lejos para ser agarrado");
                    grabbedObject = null;
                } else {
                    console.log("Objeto agarrado:", grabbedObject);
                }
            }
        }
    }
    else {
        isDragging = false;
        grabbedObject.body.collisionFilterGroup = 1;
        grabbedObject.body.collisionFilterMask = -1; 
        grabbedObject = null;
    }
});


function limitVelocity(body, maxLinearVelocity, maxAngularVelocity) {
    // Limitar la velocidad lineal
    const linearVelocity = body.velocity;
    if (linearVelocity.length() > maxLinearVelocity) {
        linearVelocity.scale(maxLinearVelocity / linearVelocity.length(), linearVelocity);
    }

    // Limitar la velocidad angular
    const angularVelocity = body.angularVelocity;
    if (angularVelocity.length() > maxAngularVelocity) {
        angularVelocity.scale(maxAngularVelocity / angularVelocity.length(), angularVelocity);
    }
}

let highlightedObject = null;
let originalMaterial = null;

function animate() {
    
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const fixedTimeStep = 1.0 / 60.0;  // 60 FPS
    const maxSubSteps = 3;
    if (controls.isLocked === true) {
        world.step(fixedTimeStep, delta, maxSubSteps);
        const direction = new THREE.Vector3();
        const velocity = new THREE.Vector3();

        const maxLinearVelocity = 20;  // Velocidad lineal máxima permitida
        const maxAngularVelocity = 5;  // Velocidad angular máxima permitida
        world.bodies.forEach(body => {
            limitVelocity(body, maxLinearVelocity, maxAngularVelocity);
        });

        // Actualizar el raycaster con la dirección de la cámara
        raycaster.setFromCamera(pointer, camera);
        const intersectableMeshes = physicsObjects.map(obj => obj.mesh);

        // Detectar intersección con objetos interactuables (excluyendo el mapa)
        const intersects = raycaster.intersectObjects(intersectableMeshes, true);
        if (intersects.length > 0) {
            console.log("Intersección detectada con:", intersects[0].object.name);
        }
        
        // Deshacer el highlight del objeto anterior si ya no está en el centro
        if (highlightedObject && intersects.length > 0 && highlightedObject !== intersects[0].object) {
            highlightedObject.material = originalMaterial; // Restaurar el material original
            highlightedObject = null;
        }

        if (intersects.length > 0) {
            const intersected = intersects[0].object;

            // Resaltar el objeto solo si es una "pieza"
            if (!highlightedObject || highlightedObject !== intersected) {
                if (highlightedObject) {
                    highlightedObject.material = originalMaterial; // Restaurar el material original
                }
                highlightedObject = intersected;
                originalMaterial = intersected.material; // Guardar el material original
                intersected.material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Resaltar
            }
        } else if (highlightedObject) {
            highlightedObject.material = originalMaterial;
            highlightedObject = null;
        }
        
        if (grabbedObject) {
            
            grabbedObject.body.wakeUp();
            console.log("Objeto agarrado:", grabbedObject.mesh.name);

            // Obtener la dirección en la que mira la cámara
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
        
            // Calcular la nueva posición del objeto frente al jugador
            const newPos = new THREE.Vector3().copy(camera.position).add(cameraDirection.multiplyScalar(30)); // Ajustar la distancia según lo que necesites
            console.log("Nueva posición calculada:", newPos);
            // Actualizar la posición del cuerpo físico de Cannon.js
            grabbedObject.body.position.copy(newPos);
            mesh.position.copy(newPos);
            const physicsObject = physicsObjects.find(obj => obj.body === grabbedObject.body);
            if (physicsObject) {
                console.log("Objeto encontrado:", physicsObject.mesh.name);
                physicsObject.mesh.position.copy(newPos);
                physicsObject.mesh.quaternion.copy(grabbedObject.body.quaternion);
            }
            console.log("Nueva posición del cuerpo:", grabbedObject.body.position.clone());


        }

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize();

        direction.z = Number(keysPressed.forward) - Number(keysPressed.backward);
        direction.x = Number(keysPressed.right) - Number(keysPressed.left);

        velocity.add(forward.clone().multiplyScalar(direction.z));
        velocity.add(right.clone().multiplyScalar(direction.x));
        velocity.normalize().multiplyScalar(moveSpeed);

        const contactNormal = new CANNON.Vec3();
        let numContacts = 0;

        world.contacts.forEach((contact) => {
            if (contact.bi === playerBody || contact.bj === playerBody) {
                if (contact.bi === playerBody) {
                    contact.ni.negate(contactNormal);
                } else {
                    contactNormal.copy(contact.ni);
                }
                numContacts++;
            }
        });

        if (numContacts > 0) {
            const angle = Math.acos(contactNormal.dot(new CANNON.Vec3(0, 1, 0)));
            const maxSlopeAngle = Math.PI / 4;
            if (angle < maxSlopeAngle) {
                playerBody.velocity.x = velocity.x;
                playerBody.velocity.z = velocity.z;
            } else {
                playerBody.velocity.x = 0;
                playerBody.velocity.z = 0;
            }
        }

        
        playerMesh.position.copy(playerBody.position);
        controls.getObject().position.copy(playerBody.position);
        camera.position.y = playerBody.position.y + playerHeight;

        // Sincronizar todas las mallas con sus cuerpos de Cannon.js
        physicsObjects.forEach(({ mesh, body }) => {
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        });

        spheres.forEach(({ mesh, offset, body }) => {
            body.angularVelocity.x = 0;  
            body.angularVelocity.z = 0;
            const rotatedOffset = offset.clone().applyQuaternion(body.quaternion);
            const worldPosition = new THREE.Vector3().copy(body.position).add(rotatedOffset);
            mesh.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
            mesh.quaternion.copy(body.quaternion);
        });
    }

    renderer.render(scene, camera);
}

animate();
