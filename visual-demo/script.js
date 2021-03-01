var scene, camera, renderer, isRunning, currentAnimationFrame, controls, raycaster, mouse, lastIntersected;

var sceneRawData;
var sceneData = {
    walls: [],
    floor: [],
    objects: []
};

/**
 * Init
 */
function init() {
    // init scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    
    // init renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    // init camera controls
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enablePan = false;

    // raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // start animation
    startAnimation();

    // load data geometry
    $.ajax({
        type: "Get",
        url: "data/example.json",
        dataType: "json",
        success: function(data) {
            sceneRawData = data;

            // lights
            const light1 = new THREE.DirectionalLight( 0xffffff, 0.6 );
            light1.position.set(0, 1, 0);
            scene.add( light1 );

            const light2 = new THREE.DirectionalLight( 0xffffff, 0.5 );
            light2.position.set(1, 0, 0);
            scene.add( light2 );

            const light3 = new THREE.DirectionalLight( 0xffffff, 0.4 );
            light3.position.set(-1, 0, 0);
            scene.add( light3 );

            const light4 = new THREE.DirectionalLight( 0xffffff, 0.3 );
            light4.position.set(0, 0, 1);
            scene.add( light4 );

            const light5 = new THREE.DirectionalLight( 0xffffff, 0.2 );
            light5.position.set(0, 0, -1);
            scene.add( light5 );

            // floor material
            const floorMaterial = new THREE.MeshLambertMaterial({color: 0xAAAAAA});
            floorMaterial.side = THREE.DoubleSide;

            // wall material
            const wallMaterial = new THREE.MeshLambertMaterial({color: 0xDDDDDD});
            wallMaterial.side = THREE.DoubleSide;

            // floor
            const arraypoints = sceneRawData.floor;
            arraypoints.reverse();
            const points = [];
            
            for (var i=0; i< arraypoints.length;i++){
                points.push(arraypoints[i].map(Number));
            }
            
            const shape = new THREE.Shape();

            shape.moveTo(points[0][0], points[0][1]);
            for (var i = 0; i < points.length; i++) {
                shape.lineTo(points[i][0], points[i][1]);
            }

            const geometry = new THREE.ShapeGeometry( shape );

            const floor = new THREE.Mesh( geometry, floorMaterial );
            floor.rotation.set(Math.PI * 0.5, 0, 0);
            floor.geometry.computeFaceNormals();
        
            scene.add( floor );
            sceneData.floor.push(floor);

            // temp
            var color = 0;
            for (var i = 0; i < points.length; i ++) {

                var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({color: 0xFFFFFF}));
                mesh.material.color.setHSL(color, 1, 0.5)
                mesh.position.set(points[i][0], 0, points[i][1]);
                scene.add( mesh );

                color += 1 / points.length;
            }           
            // walls
            for (var i = 0; i < sceneRawData.walls.length; i++) {
                const geometry = new THREE.BufferGeometry();

                const vertices = new Float32Array([
                    sceneRawData.walls[i].from.x, 0,  sceneRawData.walls[i].from.z, // 0
                    sceneRawData.walls[i].to.x, 0,  sceneRawData.walls[i].to.z, // 1
                    sceneRawData.walls[i].from.x, sceneRawData.walls[i].height,  sceneRawData.walls[i].from.z,  // 2
                    sceneRawData.walls[i].to.x, sceneRawData.walls[i].height,  sceneRawData.walls[i].to.z  // 3
                ]);

                const faces = [
                    0, 3, 2,
                    0, 1, 3,
                ];

                const normals = new Float32Array([
                    0, 0, 0,
                    0, 0, 0,
                    0, 0, 0,
                    0, 0, 0
                ]);
                
                geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
                geometry.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
                geometry.setIndex(faces);

                const wall = new THREE.Mesh( geometry, wallMaterial );
                wall.geometry.computeVertexNormals();
                wall.geometry.computeFaceNormals();
                

                scene.add( wall );
                sceneData.walls.push(wall);
            }

            // objects
            for (var i = 0; i < sceneRawData.objects.length; i++) {
                const geometry = new THREE.BoxGeometry(
                    sceneRawData.objects[i].size.x,
                    sceneRawData.objects[i].size.y,
                    sceneRawData.objects[i].size.z);
                const material = new THREE.MeshLambertMaterial({emissive: 0xFFFFFF, emissiveIntensity: 0});
                material.color.copy(new THREE.Color(sceneRawData.objects[i].color))

                object = new THREE.Mesh( geometry, material );

                object.position.set(
                    sceneRawData.objects[i].position.x,
                    sceneRawData.objects[i].position.y,
                    sceneRawData.objects[i].position.z
                );

                object.uuid = sceneRawData.objects[i].id;
                object._type = "scene-object"

                scene.add( object );
                sceneData.objects.push(object);
            }

            // set camera initial position
            camera.position.x = sceneRawData.dimensions.x * 1.5;
            camera.position.y = sceneRawData.dimensions.y * 2.5;
            camera.position.z = sceneRawData.dimensions.z * 1.5;

            // where the camera is pointed
            controls.target.set(sceneRawData.dimensions.x * 0.5, sceneRawData.dimensions.y * 0.5, sceneRawData.dimensions.z * 0.5);
        },
        error: function(){
            alert("file not found");
        }
    });

    window.addEventListener( 'mousemove', onMouseMove, false );
    window.addEventListener( 'resize', onWindowResize, false );
}

/**
 * On window resize
 */
function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

/**
 * Start animation
 */
function startAnimation() {
    renderer.setAnimationLoop( mainLoop );
}

/**
 * Stop animation
 */
function stopAnimation() {
    renderer.setAnimationLoop( null );
}

/**
 * Animate
 */
function mainLoop(deltaTime) {
    controls.update();

    // update the picking ray with the camera and mouse position
	raycaster.setFromCamera( mouse, camera );

	// calculate objects intersecting the picking ray
	const intersects = raycaster.intersectObjects( scene.children );

    if (intersects.length > 0) {
        if (lastIntersected != null) {
            lastIntersected.material.emissiveIntensity = 0;
            objectIdDisplay.innerHTML = "";
        }
        
        if (intersects[0].object._type === "scene-object") {
            lastIntersected = intersects[0].object;
            lastIntersected.material.emissiveIntensity = 0.1;
            objectIdDisplay.innerHTML = lastIntersected.uuid;
        }
    }
    
    renderer.render( scene, camera );
};

/**
 * On mouse move
 */
function onMouseMove( event ) {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}