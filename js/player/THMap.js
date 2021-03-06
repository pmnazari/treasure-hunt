var THMap = function(controller)
{
	this.controller = controller;
};

THMap.prototype = {

	/**
	 * Initialize the 3D Map
	 * @param window The window in which to draw the map.
	 * @param containerElement The HTML element in which to draw the map.
	 * @param callback A callback to trigger once everything is loaded.
	 */
	Start: function(window, containerElement, callback) {

		this.window = window; // Save the window variable
		var that = this; // Save 'this' for inner function contexts

		// Init the renderer/canvas
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		containerElement.appendChild(this.renderer.domElement);

		// Init the Raycaster
		this.raycaster = new THREE.Raycaster();
		this.mousePos = new THREE.Vector2();
		this.renderer.domElement.addEventListener('mousemove', function(event) {
			that.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
			that.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
		});
		this.renderer.domElement.addEventListener('mousedown', function(event) {
			that._OnMouseDown(event);
		}, false);
		this.renderer.domElement.addEventListener('click', function(event) {
			that._OnMouseUp(event);
		}, false);


		// OnResize
		window.addEventListener('resize', function(event) {
			that.renderer.setSize(that.window.innerWidth, that.window.innerHeight);
			that.camera.aspect = that.window.innerWidth / that.window.innerHeight;
			that.camera.updateProjectionMatrix();
		}, false);

		// Load 3D objects
		this._LoadObjects({
			"scene": "./assets/Objects/scene.json",
			"ship": "./assets/Objects/ship.json",
		}, function(loadedObjects) {

			//save the main scene
			that.scene = loadedObjects["scene"];
			that.scene.background = new THREE.Color(0x999999); //grey bg

			// mirror the islands (I don't know why this is necessary...)
			var islands = that.scene.getObjectByName("islands").children;
			for (var i in islands) {
				islands[i].scale.x = -islands[i].scale.x;
				islands[i].scale.y = -islands[i].scale.y;
			}

			// Save the ship model
			that.shipObject = loadedObjects["ship"];

			// Call other initialization Functions
			that._InitLabels();
			that._InitOcean();
			that._InitLights();
			that._InitCamera();
			that._InitSky();
			that._InitPathfinding();
						
			// Callback
			if (callback) callback();
			
			// Begin rendering loop
			that._Render();
		});
	},

	/**
	 * Load 3D objects asynchronously (models/scenes)
	 * @param filenames An object of key-value pairs. Each value should be a filename.
	 * @param callback A function to call when loading is complete. The function should take one argument: an object of key-value paris. Each value will be a loaded THREE.Object3D.
	 */
	_LoadObjects: function(filenames, callback)
	{
		var out = {};

		var loader = new THREE.ObjectLoader();
		for (let key in filenames)
		{
			var filename = filenames[key];
			loader.load(filename, function(loadedScene) {
				out[key] = loadedScene;
				finishLoading();
			});
		}

		function finishLoading()
		{
			if (Object.keys(out).length == Object.keys(filenames).length)
			{
				callback(out);
			}
		}
	},

	/**
	 * Initialize labels based on hierarchy elements named "Label:<label contents>".
	 */
	_InitLabels: function()
	{
		var that = this;

		var prefix = "Label:";

		this.scene.traverseVisible(function(obj) { // foreach object in scene

			if (obj.name.startsWith(prefix)) // then make a label
			{
				var text = obj.name.substr(prefix.length);

				var bb = that._CreateBillboard(text);
				bb.position.z = Math.random() * 0.01;
				that._RegisterSpriteScaling(bb, 1, 3, 10, 4);
				obj.add(bb);
			}
		});
	},

	/**
	 * An object with keys "sunny" and "rain" pointing to materials.
	 */
	skyMaterials: {},
	
	/**
	 * Initialize the skybox.
	 */
	_InitSky: function()
	{
		// Init Sky Effect
		this.sky = new THREE.Sky();
		this.sky.scale.setScalar(450000);
		this.scene.add(this.sky);

		// Init Sun
		this.sun = new THREE.Mesh(
			new THREE.SphereBufferGeometry(20000, 16, 8),
			new THREE.MeshBasicMaterial(0xffffff)
		);
		this.sun.position.y = -700000;
		//this.scene.add(sun);

		// Set sky parameters
		var uniforms = this.sky.material.uniforms;
		uniforms.turbidity.value = 10;
		uniforms.rayleigh.value = 2;
		uniforms.mieCoefficient.value = 0.005;
		uniforms.mieDirectionalG.value = 0.95;
		uniforms.luminance.value = 1;

		// Set sky and sun distance
		var distance = 400000;
		var theta = -0.02 * Math.PI;
		var phi = -0.5 * Math.PI;
		this.sun.position.x = distance * Math.cos(phi);
		this.sun.position.y = distance * Math.sin(phi) * Math.sin(theta);
		this.sun.position.z = distance * Math.sin(phi) * Math.cos(theta);
		uniforms.sunPosition.value.copy(this.sun.position);

		// Init fog
		// this.scene.fog = new THREE.Fog( 0xffffff, 10, 1000 );

		// Init SKYBOX
		var imagePrefixSunny = "assets/Textures/SkyboxSet1/TropicalSunnyDay/TropicalSunnyDay";
		var imagePrefixRain = "assets/Textures/SkyboxSet1/DarkStormy/DarkStormy";
		var directions = ["Left2048","Right2048","Up2048","Down2048","Front2048","Back2048"];
		var imageSuffix = ".png";
		var skyGeometry = new THREE.CubeGeometry(10000,10000,10000);
		
		var materialArraySunny = [];
		var materialArrayRain = [];
		for (var i=0; i<6; i++)
		{
			materialArraySunny.push(new THREE.MeshBasicMaterial({
				map: THREE.ImageUtils.loadTexture(imagePrefixSunny + directions[i] + imageSuffix),
				side: THREE.BackSide,
				transparent: true,
				opacity: 0.5
			}));
			materialArrayRain.push(new THREE.MeshBasicMaterial({
				map: THREE.ImageUtils.loadTexture(imagePrefixRain + directions[i] + imageSuffix),
				side: THREE.BackSide,
				transparent: true,
				opacity: 0.5
			}));
		}
		this.skyMaterials.sunny = new THREE.MeshFaceMaterial(materialArraySunny);
		this.skyMaterials.rain = new THREE.MeshFaceMaterial(materialArrayRain);
		var skyBox = new THREE.Mesh(skyGeometry, this.skyMaterials.sunny);

		this.skyBox = skyBox;
		
		this.scene.add(skyBox);
		
		// Init lightning box!
		var lightningBoxGeometry = new THREE.CubeGeometry(900, 900, 900);
		var lightningBoxMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.BackSide,
			transparent: true,
			opacity: 0.0
		});
		this.lightningBox = new THREE.Mesh(lightningBoxGeometry, lightningBoxMaterial);
		this.scene.add(this.lightningBox);
		
	},

	/**
	 * Initialize the ocean.
	 */
	_InitOcean: function()
	{
		var waterColor = 0x013D57;
		let size = 1000;
		
		//extend ocean floor to horizon:
		var floor = this.scene.getObjectByName("floor");
		floor.scale.x = size*3/8;
		floor.scale.y = size*3/8;
		floor.material.color = new THREE.Color(waterColor);
		this.oceanFloor = floor;
		
		// Make the water itself
		var waterGeometry = new THREE.PlaneBufferGeometry( size, size );

		var water = new THREE.Water(
			waterGeometry,
			{
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: new THREE.TextureLoader().load( 'assets/Textures/waternormals.jpg', function ( texture ) {
					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				}),
				alpha: 0.7,
				//sunDirection: THREE.Vector3(1, 1, 1),
				sunColor: 0x000000,
				waterColor: waterColor,
				distortionScale: 0.08,
				fog: true,
				overlayTexture: new THREE.TextureLoader().load("assets/Textures/ocean_texture_trans.png")
			}
		);
		water.material.uniforms.size.value = 500;

		water.rotation.x = - Math.PI / 2;

		this.ocean = water;
		this.scene.add( water );
	},

	/**
	 * Initialize the lights.
	 */
	_InitLights: function()
	{
		// sunlight!
		this.sunlight = new THREE.PointLight();
		this.sunlight.position.set(1, 1, -1);
		this.scene.add(this.sunlight);

		this.ambient_light = new THREE.PointLight();
		this.ambient_light.position.set(0, 10, 0);
		this.scene.add(this.ambient_light);
		
		this.lightning = new THREE.PointLight();
		this.lightning.position.set(100, 100, 100);
		this.scene.add(this.lightning);
		
		// counter light
		// this.counter_light = new THREE.PointLight();
		// this.counter_light.position.set(-1, -1, 1);
		//this.scene.add(this.counter_light);

		// ambient light
		// this.moonlight = new THREE.PointLight(0x8888ff);
		// this.moonlight.position.set(0, 10, 0);
		//this.scene.add(this.moonlight);

	},

	/**
	 * Initialize the camera.
	 */
	_InitCamera: function()
	{
		// Init the camera
		this.camera = new THREE.PerspectiveCamera(75, this.window.innerWidth / this.window.innerHeight, 0.1, 2000000);

		// position camera
		this.camera.position.x = 0;
		this.camera.position.y = 9;
		this.camera.position.z = -30;
		this.camera.rotation.x = -2.18;
		this.camera.rotation.z = Math.PI;

		// Orbit controls
		var controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
		controls.minDistance = 2;
		controls.maxDistance = 15;
		controls.zoomSpeed = 2.0;
		controls.maxPolarAngle = Math.PI * 3/8;
		controls.minPanX = -10;
		controls.maxPanX = 10;
		controls.minPanZ = -10;
		controls.maxPanZ = 10;
		controls.update();
		
		window.orbiter = controls;
	},

	/**
	 * A set of map points. See MapPoint.js
	 */
	mapPoints: {},

	/**
	 * Initialize pathfinding and map points, etc.
	 */
	_InitPathfinding: function()
	{
		var that = this;

		var data = $.ajax({
			url: "./assets/pathfinding_map.txt",
			dataType: "text",
			async: false
		}).responseText;

		that.pathfinding_map = data.split(/\r\n|\r|\n/); // split by line
		that.pathfinder = new Pathfinder(that.pathfinding_map); // init Pathfinder

		// Init map points
		function addMapPoint(id, isIsland, positions, bgColor, fgColor)
		{
			var object = that.scene.getObjectByName(id);
			if (object === undefined) {
				object = that.scene.getObjectByName("Label:" + id);
			}
			
			that.mapPoints[id] = new MapPoint(that, id, isIsland, that.pathfinding_map, positions, object, bgColor, fgColor);
		}
		addMapPoint("trojan-island", true, [new Coords(8, 37)], "rgb(130, 0, 0)", "gold");
		addMapPoint("bear-island", true, [new Coords(5, 15)], "rgb(0, 0, 70)", "gold");
		addMapPoint("duck-island", true, [new Coords(12, 7)], "rgb(0, 80, 0)", "gold");
		addMapPoint("beaver-island", true, [new Coords(28, 9), new Coords(32, 9)], "black", "#FF6424");
		addMapPoint("cardinal-island", true, [new Coords(38, 18), new Coords(40, 13)], "rgb(100, 0, 0)", "white");
		addMapPoint("bruin-island", true, [new Coords(26, 39)], "darkblue", "gold");
		addMapPoint("sun-devil-island", true, [new Coords(19, 20), new Coords(16, 21)], "rgb(100, 0, 0)", "gold");
		addMapPoint("treasure-spot", true, [new Coords(39, 25)]);
		addMapPoint("SD1", false, [new Coords(10, 20)]);
		addMapPoint("SD2", false, [new Coords(13, 27)]);
		addMapPoint("SD3", false, [new Coords(21, 27)]);
		addMapPoint("SD4", false, [new Coords(26, 26)]);
		addMapPoint("SD5", false, [new Coords(31, 22)]);
		addMapPoint("SD6", false, [new Coords(30, 17)]);
		addMapPoint("T1", false, [new Coords(18, 32)]);
		addMapPoint("T2", false, [new Coords(30, 30)]);
		addMapPoint("B1", false, [new Coords(18, 37)]);
		addMapPoint("B2", false, [new Coords(38, 37)]);
	},

	/**
	 * Update a value on the pathfinding map.
	 * @param position The Coords of the position at which to change the map.
	 * @param status The status to set the position to. Valid values are "empty", "obstacle", and "parked".
	 */
	UpdatePathfindingMap(position, status)
	{
		var character = (status == "free" ? '.' : (status == "parked" ? '@' : 'x'));

		var old = this.pathfinding_map[position.y];
		this.pathfinding_map[position.y] = old.slice(0, position.x) + character + old.slice(position.x+1);
	},

	/**
	 * Create a billboard with a text label.
	 * @param text The text to print.
	 * @return A Three.Object3D that is the billboard.
	 */
	_CreateBillboard: function(text)
	{
		// Make Canvas
		var canvas = this.window.document.createElement("canvas");
		canvas.width = 1024;
		canvas.height = 256;
		document.body.appendChild(canvas);

		var ctx = canvas.getContext("2d");
		ctx.font = "Bold 100px Cousine";
		ctx.textAlign = "center";

		ctx.fillStyle = "black";
		ctx.globalAlpha = 0.5;
		var rectW = text.length * 63;
		ctx.fillRect(canvas.width/2 - rectW/2, canvas.height/2 - 40, rectW, 120);
		ctx.globalAlpha = 1;

		ctx.fillStyle = "white";
		ctx.fillText(text, canvas.width/2, canvas.height/2 + 50);

		//ctx.strokeStyle = "black";
		//ctx.strokeText(text, canvas.width/2, canvas.height/2 + 50);

		// Make Sprite
		var texture = new THREE.Texture(canvas);
		texture.needsUpdate = true;
		var material = new THREE.SpriteMaterial({
			map: texture
		});
		var sprite = new THREE.Sprite(material);
		sprite.aspectRatio = canvas.height / canvas.width;

		sprite.scale.set(5, 5/4, 1);

		return sprite;
	},

	/**
	 * Register an interpolation of a sprite's scaling as a function of its distance to the camera.
	 * @param sprite The sprite, a THREE.Sprite.
	 * @param d1 Camera distance at point 1.
	 * @param s1 Sprite scaling at point 1.
	 * @param d2 Camera distance at point 2.
	 * @param d2 Sprite scaling at point 2.
	 */
	_RegisterSpriteScaling: function(sprite, d1, s1, d2, s2)
	{
		sprite.animatedScaling = {
			d1: d1,
			s1: s1,
			d2: d2,
			s2: s2
		};
	},

	/**
	 * An array of all the ships on the map, indexed by ID. See Ship.js
	 */
	ships: {},

	/**
	 * Add a ship to the map!
	 * @param id A unique ID for this ship, to identify it later.
	 * @param displayName A string display name for this ship.
	 * @param isLocal True iff this is the local player's ship.
	 */
	AddShip(id, displayName, isLocal)
	{
		var ship = new Ship(this, id, displayName, isLocal);
		this.ships[id] = ship;
		if (isLocal) this.localShip = ship;
	},

	/**
	 * Called on mousedown.
	 * @param event The object passed to the Javascript event handler.
	 */
	_OnMouseDown: function(event) {
		this.mouseDownPos = this.mousePos.clone();
	},
	
	/**
	 * Called on mouseup.
	 * @param event The object passed to the Javascript event handler.
	 */
	_OnMouseUp: function(event) {
		
		var threshhold = 0.1; // fraction of screen
		
		if (this.mousePos.distanceTo(this.mouseDownPos) < threshhold) {
			this._OnClick(event);
		}
	},
	
	/**
	 * Called on click.
	 * @param event The object passed to the Javascript event handler.
	 */
	_OnClick: function(event) {

		if (this.mapPointSelectionEnabled)
		{
			this.raycaster.setFromCamera(this.mousePos, this.camera);
			
			var closestMapPointClicked;
			var closestMapPointDistance = Infinity;
			for (var id in this.mapPoints)
			{ // find what map point we're clicking
				var mapPoint = this.mapPoints[id];
				
				if (mapPoint.selectable) // with this code, you can select map points that are behind other (unselectable) map points. I think this is okay.
				{
					var dist = mapPoint.Intersect(this.raycaster);
					if (dist && dist < closestMapPointDistance) {
						closestMapPointDistance = dist;
						closestMapPointClicked = mapPoint;
					}
				}
			}
			
			// check that the intersection isn't under the ocean floor
			var intersects = this.raycaster.intersectObject(this.oceanFloor, false);
			if (intersects.length > 0 && intersects[0].distance < closestMapPointDistance)
				return; // the click wasn't meaningful
			
			if (closestMapPointClicked !== undefined && closestMapPointClicked.selectable == true)
			{ // then update the selection
				this.SetSelectedMapPoint(closestMapPointClicked.id);
			}
		}
	},
	
	/**
	 * Set the selectable map points.
	 * @param ids An array of map point IDs that are to be selectable. All others will be made unselectable. If false, none will be selectable.
	 */
	SetSelectableMapPoints: function(ids) {
		// make all map points unselectable
		for (var i in this.mapPoints)
		{
			this.mapPoints[i].selectable = false;
		}
		
		// make the specified map points selectable
		if (ids)
		{
			for (var i in ids)
			{
				var id = ids[i];
				
				this.mapPoints[id].selectable = true;
			}
		}
	},
	
	/**
	 * Whether map point selection is enabled. When disabled, the widgets will still be visible, but simply uncontrollable.
	 */
	mapPointSelectionEnabled: false,
	
	/**
	 * Selected MapPoint, or false if no selection
	 */
	selectedMapPoint: false,
	
	/**
	 * Set the selected map point.
	 * @param id The ID of the map point to be selected, or false to simply deselect all.
	 */
	SetSelectedMapPoint: function(id) {
		// deselect all map points
		for (var i in this.mapPoints)
		{
			this.mapPoints[i].selected = false;
		}
		
		if (id)
		{	// select this map point
			this.selectedMapPoint = this.mapPoints[id];
			this.selectedMapPoint.selected = true;
		} else { // select no map point
			this.selectedMapPoint = false;
		}
	},

	/**
	 * Enter the rendering/animation loop.
	 */
	_Render: function() {
				
		var that = this;
		function animate() {
			requestAnimationFrame(animate);

			var hoveredShip; // the ship that the mouse is hovering over.
			var closestShipDist; // the distance from the camera to the closest ship.
			for (i in that.ships) // Pick a ship to display the label of
			{
				var ship = that.ships[i];

				ship.labelVisible = false;
				that.raycaster.setFromCamera(that.mousePos, that.camera);
				var intersects = that.raycaster.intersectObject(ship.object, true);
				for (x in intersects) {
					if (!intersects[x].object.isSprite) {
						if (hoveredShip === undefined || intersects[x].distance < closestShipDist) {
							hoveredShip = ship;
							closestShipDist = intersects[x].distance;
						}
					}
				}
			}
			if (hoveredShip !== undefined) hoveredShip.labelVisible = true;
			for (i in that.ships) // Update ships
			{
				that.ships[i].Update();
			}
			
			for (i in that.mapPoints) // Update map points
			{
				that.mapPoints[i].Update();
			}

			that._AnimateSky();
			that._AnimateOcean();
			that._AnimateSpriteScaling();

			that.renderer.render(that.scene, that.camera);
		}
		animate();
	},

	/**
	 * Pass a day.
	 * @param weather The weather state for the new day. ("sunny" or "rain")
	 * @param callback A callback to be triggered at the end of the day cycle.
	 */
	PassDay: function(weather, callback) {
		this.dayCycleClockStartTime = Date.now();
		this.newDayWeather = weather;
		this.onNewDay = callback;
	},
	
	/**
	 * The weather state, either "sunny" or "rain".
	 */
	weather: "sunny",
	
	/**
	 * Set the weather state immediately (abruptly).
	 * @param weather Either "sunny" or "rain".
	 */
	SetWeather: function(weather)
	{
		this.skyBox.material = this.skyMaterials[weather];
		this.weather = weather;
		
		// SOUNDS:
		if (this.weatherSound) // fade out old sound
			window.sounds.fadeInOut(this.weatherSound, window.sounds.ambientNoiseVolume, 0, 6000);
		
		let atIsland = (this.localShip.mapPoint.isIsland && !this.localShip.quartersToDestination);
		let newSound = (weather == "rain" ? "stormyAmbience" : (atIsland ? "dockedAmbience" : "sunnyAmbience"));
		window.sounds.fadeInOut(newSound, 0, window.sounds.ambientNoiseVolume, 6000);
		
		this.weatherSound = newSound;
	},

	/**
	 * The time at which the day/night cycle should pause for gameplay.
	 */
	dayCycleStopTime: 9*Math.PI/8 * 1000,

	/**
	 * The current time in the day/night cycle.
	 */
	dayCycleTime: -1,

	/**
	 * Animate the day/night cycle
	 */
	 _AnimateSky: function() {

		if (this.dayCycleTime < 0) this.dayCycleTime = this.dayCycleStopTime;

		var cycleLength = 2*Math.PI*1000;
		if (!this.dayCycleClockStartTime) this.dayCycleClockStartTime = Date.now() - cycleLength;

		this.dayCycleTime = this.dayCycleStopTime + Math.min(Date.now() - this.dayCycleClockStartTime, cycleLength);
		
		if ((this.dayCycleTime / cycleLength > 1.25) && this.newDayWeather) // it's midnight, update the weather (1.25 is a magic number...)
		{
			this.skyBox.material = this.skyMaterials[this.newDayWeather];
			this.weather = this.newDayWeather;
			this.newDayWeather = false;
			
			// SOUNDS:				
			let atIsland = (this.localShip.mapPoint.isIsland && !this.localShip.quartersToDestination);
			let newSound = (this.weather == "rain" ? "stormyAmbience" : (atIsland ? "dockedAmbience" : "sunnyAmbience"));
			
			if (this.weatherSound != newSound)
			{
				if (this.weatherSound) // fade out old sound
					window.sounds.fadeInOut(this.weatherSound, window.sounds.ambientNoiseVolume, 0, 6000);
				window.sounds.fadeInOut(newSound, 0, window.sounds.ambientNoiseVolume, 6000);
			}
			
			this.weatherSound = newSound;
		}
		if (Date.now() - this.dayCycleClockStartTime > cycleLength && this.onNewDay)
		{
			this.onNewDay();
			this.onNewDay = false;
		}

		var t = this.dayCycleTime;

		t *= 0.001; // slow down

		t = t + Math.sin(t - Math.PI/2); // make the night fast
		t = t - 0.3*Math.sin(2*t); // Make the sunrises and sunsets long and beautiful!

		// Set sky and sun distance
		var distance = 400000;
		var theta = t;
		//theta = -Math.PI/5

		var phi = -0.4 * Math.PI;
		this.sun.position.x = distance * Math.cos(theta) * Math.cos(phi);
		this.sun.position.y = distance * Math.sin(theta) * Math.sin(phi);
		this.sun.position.z = distance * Math.cos(theta); // height
		this.sky.material.uniforms.sunPosition.value.copy(this.sun.position);
		
		// Update the lighting
		this.sunlight.position.x = this.sun.position.x;
		this.sunlight.position.y = this.sun.position.y;
		this.sunlight.position.z = this.sun.position.z;

		// this.counter_light.position.x = -this.sunlight.position.x;
		// this.counter_light.position.y = this.sunlight.position.y;
		// this.counter_light.position.z = -this.sunlight.position.z;

		
		this.sunlight.intensity = Math.sin(-theta) * (this.weather == "sunny" ? 1.2 : 0.6);
		// this.counter_light.intensity = 0.2*this.sunlight.intensity;
		//this.sunlight.intensity = 0;
		
		this.ambient_light.intensity = 0.5 * this.sunlight.intensity;
		
		// Darken the sky at night!
		for (var i in this.skyBox.material)
		{
			this.skyBox.material[i].opacity = Math.min(1, THREE.Math.mapLinear(Math.sin(-theta),
				-1, 1,
				-0.5, (this.weather == "sunny" ? 0.5 : 1.0)
			));
		}
		
		// Lightning!
		this._AnimateLightning();
		
		// this.moonlight.intensity = Math.pow(Math.max(0.3, Math.sin(theta)), 0.05);

		// Update sprite lighting
		// this.scene.traverseVisible(function(obj) { // foreach object in scene
			// if (obj.isSprite)
			// {
				// obj.material.opacity = Math.pow(Math.max(0.01, Math.sin(-theta)), 0.05);
			// }
		// });

		// Update the fog color
		// var time = (theta + Math.PI/2) % (2*Math.PI); // 0 is midnight, PI is noon, 2PI is midnight
		// var color = Math.pow(0.5*Math.cos(time) + 0.5, 3);
		// this.scene.fog.color = new THREE.Color(color, color, color);
	 },
	 
	/**
	 * Start a lightning animation.
	 */
	Lightning: function()
	{
		this.lightningStartTime = Date.now();
		window.sounds.playOnce("lightningSound");
	},
	
	/**
	 * Animate lightning (call every frame).
	 */
	_AnimateLightning: function()
	{
		// if not in lighting
		this.lightningBox.material.opacity = 0;
		this.lightning.intensity = 0;
		
		var lightningLength = 550;
		var secondFlash = 1.0; // the fraction of the way through the first flash at which to start the second
		
		if (this.lightningStartTime === undefined) this.lightningStartTime = Date.now() - lightningLength;
		
		var t = Date.now() - this.lightningStartTime;
		t /= lightningLength; // normalized between 0 and 1
					
		// if in lightning
		if (t < 1.0)
		{
			var t1 = t * (secondFlash + 1);
			
			this.lightningBox.material.opacity = -2*(t1)*(t1-1); //-15*(t)*(t-1)*Math.pow(t-0.4, 2);
			this.lightning.intensity = -8*(t1)*(t1-1); //-60*(t)*(t-1)*Math.pow(t-0.4, 2);
			
			if (t1 > secondFlash) // in second flash!
			{
				var t2 = t1 - secondFlash;
				
				this.lightningBox.material.opacity = -2*(t2)*(t2-1); //-15*(t)*(t-1)*Math.pow(t-0.4, 2);
				this.lightning.intensity = -8*(t2)*(t2-1); //-60*(t)*(t-1)*Math.pow(t-0.4, 2);
			}
		}
		else if (this.nextLightning && this.nextLightning <= Date.now())
		{
			this.Lightning();
			this.nextLightning = false;
		}
		else if (this.weather == "rain" && t >= 10.0) // not in lightning, but it is raining!
		{
			this.nextLightning = Date.now() + Math.random()*5000; // every 5-10 sec, there new lightning strike!
		}
		
	},

	/**
	 * Animate the ocean.
	 */
	_AnimateOcean: function() {
		// animate water (waves)
		this.ocean.material.uniforms.time.value += 1.0 / 60.0 * 0.5;
		
		// animate ocean (tides)
		var t_ocean = Date.now() * 0.001;
		var h = 0.01;		
		var newY = h/2*Math.sin(t_ocean) + h/2;		
		this.ocean.position.y = newY;

		// animate the ships on the ocean
		for (i in this.ships)
		{
			var ship = this.ships[i];

			h = 0.05;
			ship.object.position.y = ship.baseY + h/2*Math.sin(t_ocean) + h/2;

			var a = 0.1;
			ship.object.rotation.x = -a*Math.cos(t_ocean);
		}
	},

	_Lightning : function(){

	},

	/**
	 * Animate sprite scaling (see _RegisterSpriteScaling).
	 */
	_AnimateSpriteScaling: function() {

		var that = this;

		this.scene.traverseVisible(function(obj) { // foreach object in scene

			if (obj.isSprite && obj.animatedScaling !== undefined)
			{
				var dist = obj.getWorldPosition().sub(that.camera.getWorldPosition()).dot(that.camera.getWorldDirection());

				var scale = THREE.Math.mapLinear(
					dist,
					obj.animatedScaling.d1,
					obj.animatedScaling.d2,
					obj.animatedScaling.s1,
					obj.animatedScaling.s2
				);

				scale *= Math.pow(-that.camera.getWorldDirection().dot(that.camera.up), 0.3);

				obj.scale.x = scale;
				obj.scale.y = scale * obj.aspectRatio;
			}
		});
	}


};