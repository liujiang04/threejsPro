module game {
    export class webgl_physics_cloth {
        container
        stats
        textureLoader: THREE.TextureLoader
        clock = new THREE.Clock();
        // Physics variables
        gravityConstant = -9.8;
        physicsWorld
        rigidBodies = [];
        margin = 0.05;
        hinge
        cloth
        transformAux1 = new Ammo.btTransform();
        time = 0;
        static armMovement = 0;
        controls

        constructor() {
        }

        public initUI() {
            App.removeAllCanvas()
            var d = document.createElement('div')
            d.id = 'container'
            d.innerHTML = '<br /><br /><br /><br /><br />Loading...'
            document.body.appendChild(d)
            if (!Detector.webgl) {
                Detector.addGetWebGLMessage(null);
                document.getElementById('container').innerHTML = "";
            }
            this.init();
        }

        // - Main code -
        // - Functions -
        init() {
            this.initGraphics();
            this.initPhysics();
            this.createObjects();
            this.initInput();
        }

        initGraphics() {
            this.container = document.getElementById('container');
            App.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
            App.scene = new THREE.Scene();
            App.scene.background = new THREE.Color(0xbfd1e5);
            App.camera.position.set(-12, 7, 4);
            this.controls = new THREE.OrbitControls(App.camera);
            this.controls.target.set(0, 2, 0);
            this.controls.update();
            App.renderer = new THREE.WebGLRenderer();
            App.renderer.setPixelRatio(window.devicePixelRatio);
            App.renderer.setSize(window.innerWidth, window.innerHeight);
            App.renderer.shadowMap.enabled = true;
            this.textureLoader = new THREE.TextureLoader();
            var ambientLight = new THREE.AmbientLight(0x404040);
            var scene = App.scene
            scene.add(ambientLight);
            var light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(-7, 10, 15);
            light.castShadow = true;
            var d = 10;
            light.shadow.camera.left = -d;
            light.shadow.camera.right = d;
            light.shadow.camera.top = d;
            light.shadow.camera.bottom = -d;
            light.shadow.camera.near = 2;
            light.shadow.camera.far = 50;
            light.shadow.mapSize.x = 1024;
            light.shadow.mapSize.y = 1024;
            light.shadow.bias = -0.003;
            scene.add(light);
            this.container.innerHTML = "";
            this.container.appendChild(App.renderer.domElement);
            this.stats = new Stats();
            this.stats.domElement.style.position = 'absolute';
            this.stats.domElement.style.top = '0px';
            this.container.appendChild(this.stats.domElement);
            DomTopic.addDomEventListener('resize', this.onWindowResize, this);
            Animate.addRenderRunFunction(this.animate, this)
        }


        initPhysics() {
            // Physics configuration
            var collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
            var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            var broadphase = new Ammo.btDbvtBroadphase();
            var solver = new Ammo.btSequentialImpulseConstraintSolver();
            var softBodySolver = new Ammo.btDefaultSoftBodySolver();
            this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver);
            this.physicsWorld.setGravity(new Ammo.btVector3(0, this.gravityConstant, 0));
            this.physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, this.gravityConstant, 0));
        }

        createObjects() {
            var pos = new THREE.Vector3();
            var quat = new THREE.Quaternion();
            // Ground
            pos.set(0, -0.5, 0);
            quat.set(0, 0, 0, 1);
            var ground = this.createParalellepiped(40, 1, 40, 0, pos, quat, new THREE.MeshPhongMaterial({color: 0xFFFFFF}));
            ground.castShadow = true;
            ground.receiveShadow = true;
            this.textureLoader.load("resource/textures/grid.png", function (texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(40, 40);
                ground.material['map'] = texture;
                ground.material['needsUpdate'] = true;
            });
            // Wall
            var brickMass = 0.5;
            var brickLength = 1.2;
            var brickDepth = 0.6;
            var brickHeight = brickLength * 0.5;
            var numBricksLength = 6;
            var numBricksHeight = 8;
            var z0 = -numBricksLength * brickLength * 0.5;
            pos.set(0, brickHeight * 0.5, z0);
            quat.set(0, 0, 0, 1);
            for (var j = 0; j < numBricksHeight; j++) {
                var oddRow = (j % 2) == 1;
                pos.z = z0;
                if (oddRow) {
                    pos.z -= 0.25 * brickLength;
                }
                var nRow = oddRow ? numBricksLength + 1 : numBricksLength;
                for (var i = 0; i < nRow; i++) {
                    var brickLengthCurrent = brickLength;
                    var brickMassCurrent = brickMass;
                    if (oddRow && (i == 0 || i == nRow - 1)) {
                        brickLengthCurrent *= 0.5;
                        brickMassCurrent *= 0.5;
                    }
                    var brick = this.createParalellepiped(brickDepth, brickHeight, brickLengthCurrent, brickMassCurrent, pos, quat, this.createMaterial());
                    brick.castShadow = true;
                    brick.receiveShadow = true;
                    if (oddRow && (i == 0 || i == nRow - 2)) {
                        pos.z += 0.75 * brickLength;
                    }
                    else {
                        pos.z += brickLength;
                    }
                }
                pos.y += brickHeight;
            }

            // The cloth
            // Cloth graphic object
            var clothWidth = 4;
            var clothHeight = 3;
            var clothNumSegmentsZ = clothWidth * 5;
            var clothNumSegmentsY = clothHeight * 5;
            var clothSegmentLengthZ = clothWidth / clothNumSegmentsZ;
            var clothSegmentLengthY = clothHeight / clothNumSegmentsY;
            var clothPos = new THREE.Vector3(-3, 3, 2);
            //var clothGeometry = new THREE.BufferGeometry();
            var clothGeometry = new THREE.PlaneBufferGeometry(clothWidth, clothHeight, clothNumSegmentsZ, clothNumSegmentsY);
            clothGeometry.rotateY(Math.PI * 0.5);
            clothGeometry.translate(clothPos.x, clothPos.y + clothHeight * 0.5, clothPos.z - clothWidth * 0.5);
            //var clothMaterial = new THREE.MeshLambertMaterial( { color: 0x0030A0, side: THREE.DoubleSide } );
            var clothMaterial = new THREE.MeshLambertMaterial({color: 0xFFFFFF, side: THREE.DoubleSide});
            this.cloth = new THREE.Mesh(clothGeometry, clothMaterial);
            this.cloth.castShadow = true;
            this.cloth.receiveShadow = true;
            App.scene.add(this.cloth);
            let self = this
            this.textureLoader.load("resource/textures/grid.png", function (texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(clothNumSegmentsZ, clothNumSegmentsY);
                self.cloth.material.map = texture;
                self.cloth.material.needsUpdate = true;
            });
            // Cloth physic object
            var softBodyHelpers = new Ammo.btSoftBodyHelpers();
            var clothCorner00 = new Ammo.btVector3(clothPos.x, clothPos.y + clothHeight, clothPos.z);
            var clothCorner01 = new Ammo.btVector3(clothPos.x, clothPos.y + clothHeight, clothPos.z - clothWidth);
            var clothCorner10 = new Ammo.btVector3(clothPos.x, clothPos.y, clothPos.z);
            var clothCorner11 = new Ammo.btVector3(clothPos.x, clothPos.y, clothPos.z - clothWidth);
            var clothSoftBody = softBodyHelpers.CreatePatch(this.physicsWorld.getWorldInfo(), clothCorner00, clothCorner01, clothCorner10, clothCorner11, clothNumSegmentsZ + 1, clothNumSegmentsY + 1, 0, true);
            var sbConfig = clothSoftBody.get_m_cfg();
            sbConfig.set_viterations(10);
            sbConfig.set_piterations(10);
            clothSoftBody.setTotalMass(0.9, false);
            Ammo.castObject(clothSoftBody, Ammo.btCollisionObject).getCollisionShape().setMargin(this.margin * 3);
            this.physicsWorld.addSoftBody(clothSoftBody, 1, -1);
            this.cloth.userData.physicsBody = clothSoftBody;
            // Disable deactivation
            clothSoftBody.setActivationState(4);
            // The base
            var armMass = 2;
            var armLength = 3 + clothWidth;
            var pylonHeight = clothPos.y + clothHeight;
            var baseMaterial = new THREE.MeshPhongMaterial({color: 0x606060});
            pos.set(clothPos.x, 0.1, clothPos.z - armLength);
            quat.set(0, 0, 0, 1);
            var base = this.createParalellepiped(1, 0.2, 1, 0, pos, quat, baseMaterial);
            base.castShadow = true;
            base.receiveShadow = true;
            pos.set(clothPos.x, 0.5 * pylonHeight, clothPos.z - armLength);
            var pylon = this.createParalellepiped(0.4, pylonHeight, 0.4, 0, pos, quat, baseMaterial);
            pylon.castShadow = true;
            pylon.receiveShadow = true;
            pos.set(clothPos.x, pylonHeight + 0.2, clothPos.z - 0.5 * armLength);
            var arm = this.createParalellepiped(0.4, 0.4, armLength + 0.4, armMass, pos, quat, baseMaterial);
            arm.castShadow = true;
            arm.receiveShadow = true;
            // Glue the cloth to the arm
            var influence = 0.5;
            clothSoftBody.appendAnchor(0, arm.userData.physicsBody, false, influence);
            clothSoftBody.appendAnchor(clothNumSegmentsZ, arm.userData.physicsBody, false, influence);
            // Hinge constraint to move the arm
            var pivotA = new Ammo.btVector3(0, pylonHeight * 0.5, 0);
            var pivotB = new Ammo.btVector3(0, -0.2, -armLength * 0.5);
            var axis = new Ammo.btVector3(0, 1, 0);
            this.hinge = new Ammo.btHingeConstraint(pylon.userData.physicsBody, arm.userData.physicsBody, pivotA, pivotB, axis, axis, true);
            this.physicsWorld.addConstraint(this.hinge, true);
        }


        createParalellepiped(sx, sy, sz, mass, pos, quat, material) {
            var threeObject = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), material);
            var shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
            shape.setMargin(this.margin);
            this.createRigidBody(threeObject, shape, mass, pos, quat);
            return threeObject;
        }


        createRigidBody(threeObject, physicsShape, mass, pos, quat) {
            threeObject.position.copy(pos);
            threeObject.quaternion.copy(quat);
            var transform = new Ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
            transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
            var motionState = new Ammo.btDefaultMotionState(transform);
            var localInertia = new Ammo.btVector3(0, 0, 0);
            physicsShape.calculateLocalInertia(mass, localInertia);
            var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia);
            var body = new Ammo.btRigidBody(rbInfo);
            threeObject.userData.physicsBody = body;
            App.scene.add(threeObject);
            if (mass > 0) {
                this.rigidBodies.push(threeObject);
                // Disable deactivation
                body.setActivationState(4);
            }
            this.physicsWorld.addRigidBody(body);
        }


        createRandomColor() {
            return Math.floor(Math.random() * (1 << 24));
        }

        createMaterial() {
            return new THREE.MeshPhongMaterial({color: this.createRandomColor()});
        }

        initInput() {
            window.addEventListener('keydown', function (event) {
                switch (event.keyCode) {
                    // Q
                    case 81:
                        webgl_physics_cloth.armMovement = 1;
                        break;
                    // A
                    case 65:
                        webgl_physics_cloth.armMovement = -1;
                        break;
                }
            }, false);
            window.addEventListener('keyup', function (event) {
                webgl_physics_cloth.armMovement = 0;
            }, false);
        }

        onWindowResize() {
            App.camera.aspect = window.innerWidth / window.innerHeight;
            App.camera.updateProjectionMatrix();
            App.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        animate() {
            var deltaTime = this.clock.getDelta();
            this.updatePhysics(deltaTime);
            this.time += deltaTime;
            this.stats.update();
        }

        // render() {
        //     var deltaTime = clock.getDelta();
        //     this.updatePhysics(deltaTime);
        //     App.renderer.render(App.scene, App.camera);
        //     time += deltaTime;
        // }
        updatePhysics(deltaTime) {
            // Hinge control
            this.hinge.enableAngularMotor(true, 0.8 * webgl_physics_cloth.armMovement, 50);
            // Step world
            this.physicsWorld.stepSimulation(deltaTime, 10);
            // Update cloth
            var softBody = this.cloth.userData.physicsBody;
            var clothPositions = this.cloth.geometry.attributes.position.array;
            var numVerts = clothPositions.length / 3;
            var nodes = softBody.get_m_nodes();
            var indexFloat = 0;
            for (var i = 0; i < numVerts; i++) {
                var node = nodes.at(i);
                var nodePos = node.get_m_x();
                clothPositions[indexFloat++] = nodePos.x();
                clothPositions[indexFloat++] = nodePos.y();
                clothPositions[indexFloat++] = nodePos.z();
            }
            this.cloth.geometry.computeVertexNormals();
            this.cloth.geometry.attributes.position.needsUpdate = true;
            this.cloth.geometry.attributes.normal.needsUpdate = true;
            // Update rigid bodies
            for (var i = 0, il = this.rigidBodies.length; i < il; i++) {
                var objThree = this.rigidBodies[i];
                var objPhys = objThree.userData.physicsBody;
                var ms = objPhys.getMotionState();
                if (ms) {
                    ms.getWorldTransform(this.transformAux1);
                    var p = this.transformAux1.getOrigin();
                    var q = this.transformAux1.getRotation();
                    objThree.position.set(p.x(), p.y(), p.z());
                    objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

                }
            }
        }
    }
}