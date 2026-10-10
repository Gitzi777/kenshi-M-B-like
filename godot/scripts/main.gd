extends Node3D
## Assemble la scène : touches, terrain, décor, ville, joueur, PNJ, aide à l'écran.

const NPC_SCRIPT := preload("res://scripts/npc.gd")
const NPC_TINTS := [Color(0.45, 0.42, 0.38), Color(0.5, 0.3, 0.22), Color(0.3, 0.33, 0.36)]

@onready var terrain: Terrain = $Terrain
@onready var scatter: Node3D = $Scatter
@onready var town: Node3D = $Town
@onready var player: Character = $Player
@onready var camera_rig: Node3D = $CameraRig


func _ready() -> void:
	_setup_inputs()
	var spawn := Vector3.ZERO
	var town_pos := Vector3(town.position.x, 0, town.position.z)
	terrain.flat_zones = [Vector3(spawn.x, spawn.z, 12.0), Vector3(town_pos.x, town_pos.z, 75.0)]
	terrain.generate()

	var to_spawn := (spawn - town_pos).normalized()
	town.build(terrain.get_height(town_pos.x, town_pos.z), to_spawn)
	scatter.keep_clear.assign([Vector3(spawn.x, spawn.z, 15.0), Vector3(town_pos.x, town_pos.z, 80.0)])
	scatter.populate(terrain)

	player.global_position = Vector3(spawn.x, terrain.get_height(spawn.x, spawn.z) + 0.2, spawn.z)
	# La caméra regarde vers la ville au départ.
	var to_town := town_pos - spawn
	camera_rig.yaw = atan2(-to_town.x, -to_town.z)
	player.visual.rotation.y = atan2(to_town.x, to_town.z)

	for i in NPC_TINTS.size():
		var npc := CharacterBody3D.new()
		npc.set_script(NPC_SCRIPT)
		npc.name = "PNJ%d" % (i + 1)
		npc.tint = NPC_TINTS[i]
		npc.waypoints = town.waypoints
		add_child(npc)
		var p: Vector3 = town.waypoints[i * 3]
		npc.global_position = Vector3(p.x, terrain.get_height(p.x, p.z) + 0.2, p.z)

	_add_help()


func _add_help() -> void:
	var layer := CanvasLayer.new()
	var label := Label.new()
	label.text = "ZQSD : marcher   Maj : courir   Clic / F : frapper   Doigt sur le trackpad : tourner la caméra\n" \
		+ "Deux doigts / pincer : zoom   Flèches : caméra   H : coup reçu   K : mort   R : se relever   Échap : libérer la souris"
	label.position = Vector2(16, 12)
	label.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	layer.add_child(label)
	add_child(layer)


## Crée les touches. On utilise la POSITION physique des touches :
## W/A/S/D d'un clavier QWERTY = Z/Q/S/D sur ton clavier AZERTY.
func _setup_inputs() -> void:
	_bind("move_forward", [KEY_W])
	_bind("move_back", [KEY_S])
	_bind("move_left", [KEY_A])
	_bind("move_right", [KEY_D])
	_bind("run", [KEY_SHIFT])
	_bind("attack", [KEY_F], [MOUSE_BUTTON_LEFT])
	_bind("cam_left", [KEY_LEFT])
	_bind("cam_right", [KEY_RIGHT])
	_bind("cam_up", [KEY_UP])
	_bind("cam_down", [KEY_DOWN])
	_bind("debug_hit", [KEY_H])
	_bind("debug_die", [KEY_K])
	_bind("debug_revive", [KEY_R])


func _bind(action: String, keys: Array, mouse_buttons: Array = []) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)
	for b in mouse_buttons:
		var mb := InputEventMouseButton.new()
		mb.button_index = b
		InputMap.action_add_event(action, mb)
