
/**
 * Init a ship
 * @param thmap A pointer back to the THMap.
 * @param id A unique ID for this ship.
 * @param displayName A string display name for this ship.
 * @param isLocal True iff this is the local player's ship.
 */

var Ship = function(thmap, id, displayName, isLocal)
{
	// save values
	this.thmap = thmap;
	this.id = id;
	this.displayName = displayName;
	this.isLocal = isLocal;

	this.mapPoint = false;
	this.quartersToDestination = false;
	this.previousMapPoint = false;
	this.betweenMapPoints = false;
	this.destination = false;
		
	// set a random starting angle
	var angle = THREE.Math.randFloatSpread(2*Math.PI);
	this.forward = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
	
	// Spawn a new ship object
	this.object = this.thmap.shipObject.clone(true);
	this.object.rotation.order = "YXZ";
	this.baseY = -1;
	this.visible = false;
	thmap.scene.add(this.object);
	this.position = new Coords(-this.object.x, this.object.z);
	
	// Color the sails appropriately
	var sails = this.object.getObjectByName("Sails");
	sails.material = sails.material.clone();
	if (this.isLocal) { // Red Sails
		sails.material.color = new THREE.Color("rgb(134, 2, 4)");
	} else { // Off-White Sails
		sails.material.color = new THREE.Color("rgb(200, 200, 180)"); // TODO: this color is kinda gross... idk what would be better, though
	}
	
	// Make a label for the ship
	this.label = this.thmap._CreateBillboard(this.displayName);
	this.label.position.y = 0.4 + Math.random() * 0.01;
	this.thmap._RegisterSpriteScaling(this.label, 1, 2, 10, 4);
	this.object.add(this.label);
	this.labelVisible = false;
};

Ship.prototype = {
	
	/**
	 * The time of the last update in msec.
	 */
	lastUpdateTime: -1,
	
	/**
	 * The path we are on.
	 */
	path: [],
	
	/**
	 * The Bezier curve we are currently following!
	 */
	curve: {},
	
	/**
	 * Update the ship. This function should be called in every iteration of the game loop.
	 */
	Update: function()
	{
		// Calculate deltaT in seconds
		var deltaT = (Date.now() - this.lastUpdateTime) * 0.001;
		if (this.lastUpdateTime < 0) deltaT = 0;
		this.lastUpdateTime = Date.now();
				
		var speed = 1; // world distance / second
		var angularSpeed = 3; // radians / second
		
		if (!this.traveling && this.destination && !this.GetGridPosition().equals(this.destination)) // need to move!
		{
			this.traveling = true;
			this.turning = true;
		}
				
		if (this.traveling)
		{				
			if (this.path === undefined || this.path.length == 0 || !this.GetGridPosition().equals(this.path[0].cellPos))
			{ // There is no path, or there is but we're not at the front of it: recalculate!
					
				var pathfinder = this.thmap.pathfinder;
				this.path = pathfinder.findPath(
					this.GetGridPosition(), // startPos
					this.destination // goalPos
				);
			}
			
			var nextCell;
			var nextPoint;
			if (this.path !== undefined)
			{			
				nextCell = this.path.length > 1 ? this.path[1].cellPos : this.path[0].cellPos;
				nextPoint = this.GridToWorld(nextCell);
			}
			else
			{ // error calculating path: just teleport to destination.
				this.turning = false;
				this.path = { length: 0 };
				nextPoint = this.GridToWorld(this.destination);
			}
			
			if (this.turning)
			{ // turn in place before starting to move.
				var targetForward = new THREE.Vector2();
				targetForward.subVectors(nextPoint, this.position).normalize();
				
				var angleDifference = targetForward.angle() - this.forward.angle();
				if (angleDifference > Math.PI) angleDifference -= 2*Math.PI; // turn the shorter way
				
				var angularMovement = angularSpeed * deltaT;
				if (Math.abs(angleDifference) <= angularMovement)
				{ // snap the rest of the way
						
					this.forward = targetForward;
					this.turning = false;
					
				} else { // just rotate a little
					
					if (angleDifference < 0) angularMovement *= -1;
					var newAngle = this.forward.angle() + angularMovement;
					this.forward = new THREE.Vector2(Math.cos(newAngle), Math.sin(newAngle));
				}
			}
			else
			{ // Acutally Move!
				
				var bezierCurve;
				if (this.path.length > 2)
				{ // there is a target
			
					var targetCell = this.path[2].cellPos;
					var targetPoint = this.GridToWorld(targetCell);
			
					var scale = this.position.distanceTo(targetPoint) / 2;
			
					if (this.path.length > 3)
					{ // our target has a target.
						var targetTargetCell = this.path[3].cellPos;
						var targetForward = this.GridToWorld(targetTargetCell).sub(targetPoint).normalize();
											
						var control1 = new THREE.Vector2(), control2 = new THREE.Vector2();
						bezierCurve = new THREE.CubicBezierCurve(
							this.position, // current position
							control1.addVectors(this.position, this.forward.multiplyScalar(scale)), // control point 1
							control2.subVectors(targetPoint, targetForward.multiplyScalar(0.5*scale)), // control point 2
							targetPoint // 2 steps ahead
						);
					} else { // our target is the end of the line
					
						var control1 = new THREE.Vector2();
						bezierCurve = new THREE.QuadraticBezierCurve(
							this.position, // current position
							control1.addVectors(this.position, this.forward.multiplyScalar(scale)), // control point 1
							targetPoint // 2 steps ahead
						);
					}
				}
				else
				{ // there is no target
					var scale = this.position.distanceTo(nextPoint) / 2;
			
					var control1 = new THREE.Vector2();
					bezierCurve = new THREE.QuadraticBezierCurve(
						this.position,
						control1.addVectors(this.position, this.forward.multiplyScalar(scale)),
						nextPoint
					);			
				}
				
				var movement = speed * deltaT;
				var curveIndex = movement / bezierCurve.getLength();
				var newPosition = bezierCurve.getPointAt(curveIndex);
				var displacement = new THREE.Vector2();
				displacement.subVectors(newPosition, this.position);
				
				this.position = newPosition;
				this.forward = bezierCurve.getTangentAt(curveIndex);

				if (this.path.length == 0 || (displacement.length() <= movement && this.path.length == 1))
				{
					this.position = nextPoint;
					
					this.traveling = false;
					this.path = [];
					this._OnArrive();
				}
			}
		}
		
		// Update the object.
		this.object.position.x = -this.position.x;
		this.object.position.z = this.position.y;
		this.object.rotation.y = this.forward.angle() - Math.PI/2;
		
		// Update the label.
		this.label.visible = this.labelVisible;
		
		// Translate the ship in/out of the sea based on this.visible.
		let maxY = 0;
		let minY = -1;
		if (this.baseY != (this.visible ? maxY : minY))
		{			
			this.baseY += (this.visible ? 1 : -1) * 0.01;
			this.baseY = THREE.Math.clamp(this.baseY, minY, maxY);
			
			this.object.visible = (this.baseY != minY);
		}
	},
	
	/**
	 * Disappear from the map.
	 */
	Disappear: function()
	{
		this.visible = false;
		this._OnDepart();
	},
	
	/**
	 * Move to a map point. Automatically sets visible to true.
	 * @param mapPoint A map point to navigate to.
	 * @param quartersFrom How many quarters of the way from the otherMapPoint to the mapPoint that we want to be. Can be false or undefined if just all the way at mapPoint.
	 * @param otherMapPoint The map point from which we want to be quartersFrom quarters of the way to mapPoint. Can be false or undefined if just all the way at mapPoint.
	 * @param arrivalCallback Called upon arriving at destination. No parameters. Optional.
	 */
	MoveTo: function(mapPoint, quartersFrom, otherMapPoint, arrivalCallback)
	{
		this.arrivalCallback = arrivalCallback;
		
		if (mapPoint == this.mapPoint && quartersFrom == this.quartersToDestination && otherMapPoint == this.previousMapPoint)
		{ // no need to move, we're already there!
			this.visible = true;
			this._OnArrive();
			return;	
		}
		
		if (this.destination) this._OnDepart();
		
		this.mapPoint = mapPoint;
		if (quartersFrom >= 4) quartersFrom = false;
		this.betweenMapPoints = (quartersFrom && otherMapPoint);
		this.quartersToDestination = quartersFrom;
		this.previousMapPoint = otherMapPoint;
		
		if (!this.betweenMapPoints) // heading to a map point parking space
		{
			this.destination = mapPoint.ReserveParkingSpace(this.id); // claim new space
		}
		else // heading to a spot between map points
		{
			var pathfinder = this.thmap.pathfinder;
			var path = pathfinder.findPath(
				otherMapPoint.GetLocation(), // startPos
				mapPoint.GetLocation() // goalPos
			);
			
			var pathIndex = Math.floor((path.length - 1) * quartersFrom / 4);
			
			this.destination = path[pathIndex].cellPos;
		}
		
		if (!this.visible)
		{ // teleport, then appear
			this.position = this.GridToWorld(this.destination);
			this._OnArrive();
			
			this.visible = true;
		}
	},
	
	/**
	 * Called before departing a location.
	 */
	_OnDepart: function()
	{
		if (!this.betweenMapPoints) // parked at a map point
		{
			if (this.mapPoint) this.mapPoint.ReleaseParkingSpace(this.id);
		}
		else // stopped between map points
		{
			if (this.destination) this.thmap.UpdatePathfindingMap(this.destination, "free");
		}
	},
	
	/**
	 * Called upon arriving at destination.
	 */
	_OnArrive: function()
	{
		if (this.betweenMapPoints) // stopped between map points
		{
			this.thmap.UpdatePathfindingMap(this.destination, "parked");
		}
		
		if (this.arrivalCallback) this.arrivalCallback();
	},
		
	/**
	 * the size of one grid space in actual space
	 */
	cellSize: 8.9/22,

	/**
	 * The nearest grid position to this ship's actual position;
	 */
	GetGridPosition: function()
	{
		var map = this.thmap.pathfinding_map;
		
		var mapW = map[0].length;
		var mapH = map.length;
		var centerX = (mapW-1)/2;
		var centerY = (mapH-1)/2;

		var x = Math.round(this.position.x / this.cellSize) + centerX;
		var y = Math.round(-this.position.y / this.cellSize) + centerY
		return new Coords(x, y);
	},
		
	/**
	 * Given Coords on the pathfinding grid, returns the corresponding actual point.
	 * @param coords Coords on the pathfinding map.
	 * @returns A THREE.Vector2 representing the point in actual space.
	 */
	GridToWorld: function(coords)
	{
		var map = this.thmap.pathfinding_map;
		
		var mapW = map[0].length;
		var mapH = map.length;
		var centerX = (mapW-1)/2;
		var centerY = (mapH-1)/2;
			
		return new THREE.Vector2((coords.x - centerX) * this.cellSize, -(coords.y - centerY) * this.cellSize);	
	}
};