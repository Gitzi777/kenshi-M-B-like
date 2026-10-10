extends Node3D
## Caméra à la troisième personne, pensée pour le trackpad du Mac :
##  - glisser un doigt (souris capturée) : tourner la caméra
##  - glisser à deux doigts : haut/bas = zoom, gauche/droite = tourner
##  - pincer : zoom
##  - flèches du clavier : tourner / incliner
##  - Échap : libérer la souris ; clic : la reprendre

@export var target_path: NodePath
@export var distance := 4.5
@export var min_distance := 1.8
@export var max_distance := 14.0
@export var mouse_sensitivity := 0.003
@export var height := 1.6

var yaw := 0.0
var pitch := -0.25
var _target: Node3D
var _spring: SpringArm3D
var _zoom := 4.5


func _ready() -> void:
	top_level = true
	_target = get_node(target_path)
	_zoom = distance
	_spring = SpringArm3D.new()
	_spring.spring_length = distance
	_spring.margin = 0.25
	var probe := SphereShape3D.new()
	probe.radius = 0.2
	_spring.shape = probe
	add_child(_spring)
	var cam := Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.1
	cam.far = 4000.0
	_spring.add_child(cam)
	cam.current = true
	if _target is CollisionObject3D:
		_spring.add_excluded_object((_target as CollisionObject3D).get_rid())
	global_position = _target.global_position + Vector3.UP * height
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * mouse_sensitivity
		pitch -= event.relative.y * mouse_sensitivity
	elif event is InputEventPanGesture:
		yaw -= event.delta.x * 0.04
		_zoom += event.delta.y * 0.25
	elif event is InputEventMagnifyGesture:
		_zoom /= event.factor
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom -= 0.5
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom += 0.5
		elif event.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_zoom = clampf(_zoom, min_distance, max_distance)
	pitch = clampf(pitch, -1.3, 0.35)


func _process(delta: float) -> void:
	var turn := Input.get_axis("cam_right", "cam_left")
	var tilt := Input.get_axis("cam_down", "cam_up")
	yaw += turn * 2.0 * delta
	pitch = clampf(pitch + tilt * 1.2 * delta, -1.3, 0.35)
	var goal := _target.global_position + Vector3.UP * height
	global_position = global_position.lerp(goal, 1.0 - exp(-12.0 * delta))
	rotation = Vector3(pitch, yaw, 0.0)
	_spring.spring_length = lerpf(_spring.spring_length, _zoom, 1.0 - exp(-8.0 * delta))
