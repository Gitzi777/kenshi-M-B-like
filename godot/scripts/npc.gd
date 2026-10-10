extends Character
## PNJ simple : se promène entre des points de passage, fait des pauses,
## et se relève quelques secondes après avoir été « tué ».

## Points où le PNJ peut aller (positions dans le monde), donnés par main.gd.
var waypoints: Array[Vector3] = []

var _target := Vector3.ZERO
var _wait := 0.0
var _stuck_time := 0.0
var _dead_time := 0.0


func _ready() -> void:
	super()
	walk_speed = randf_range(1.2, 1.6)
	_wait = randf_range(0.0, 3.0)
	_pick_target()


func _physics_process(delta: float) -> void:
	move_input = Vector3.ZERO
	if is_dead:
		_dead_time += delta
		if _dead_time > 8.0:
			_dead_time = 0.0
			revive()
	elif _wait > 0.0:
		_wait -= delta
	elif not waypoints.is_empty():
		var to := _target - global_position
		to.y = 0
		if to.length() < 1.0:
			_wait = randf_range(2.0, 7.0)
			_pick_target()
		else:
			move_input = to.normalized()
			# Bloqué contre un mur ? On change de destination.
			if Vector2(velocity.x, velocity.z).length() < 0.3:
				_stuck_time += delta
				if _stuck_time > 1.5:
					_stuck_time = 0.0
					_pick_target()
			else:
				_stuck_time = 0.0
	super(delta)


func _pick_target() -> void:
	if not waypoints.is_empty():
		_target = waypoints.pick_random()
