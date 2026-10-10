class_name Character
extends CharacterBody3D
## Personnage commun (joueur et PNJ) : déplacement, animations, attaque, coups, mort.
## Les animations passent par un AnimationTree qui mélange en douceur :
##   repos ↔ marche ↔ course (selon la vitesse), + attaque, coup reçu, mort par-dessus.

signal died

@export var walk_speed := 1.6
@export var run_speed := 5.0
@export var max_health := 3
## Couleur des vêtements (appliquée seulement aux modèles sans texture).
@export var tint := Color(0.62, 0.5, 0.36)

var health := 3
var is_dead := false
var is_attacking := false
## Direction voulue dans le monde (remplie par le joueur ou l'IA). Longueur 0..1.
var move_input := Vector3.ZERO
var wants_run := false

var visual: Node3D
var anim_tree: AnimationTree
var _anim_lengths := {}
var _attack_time := 0.0
var _attack_hit_done := false
var _speed_blend := 0.0
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")


func _ready() -> void:
	health = max_health
	add_to_group("characters")
	var shape := CapsuleShape3D.new()
	shape.radius = 0.3
	shape.height = 1.8
	var col := CollisionShape3D.new()
	col.shape = shape
	col.position.y = 0.9
	add_child(col)

	var data := ModelLoader.load_character()
	visual = data["model"]
	add_child(visual)
	_apply_tint(visual)
	_setup_anim_tree(data["player"], data["anims"])


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta
	var horiz := Vector3(velocity.x, 0, velocity.z)
	var desired := Vector3.ZERO
	if not is_dead:
		var dir := Vector3(move_input.x, 0, move_input.z)
		if dir.length() > 1.0:
			dir = dir.normalized()
		var speed := run_speed if wants_run else walk_speed
		if is_attacking:
			speed *= 0.2
		desired = dir * speed
	# Accélération/freinage progressifs : évite les départs et arrêts secs.
	horiz = horiz.lerp(desired, 1.0 - exp(-7.0 * delta))
	velocity.x = horiz.x
	velocity.z = horiz.z
	move_and_slide()

	# Le corps se tourne doucement vers la direction de marche.
	if not is_dead and horiz.length() > 0.2:
		var target_yaw := atan2(horiz.x, horiz.z)
		visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, 1.0 - exp(-9.0 * delta))

	# Vitesse réelle → mélange repos/marche/course.
	_speed_blend = lerpf(_speed_blend, horiz.length(), 1.0 - exp(-10.0 * delta))
	anim_tree.set("parameters/loco/blend_position", _speed_blend)
	_update_attack(delta)


func attack() -> void:
	if is_dead or is_attacking:
		return
	is_attacking = true
	_attack_time = 0.0
	_attack_hit_done = false
	anim_tree.set("parameters/attack/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)


func take_hit(from: Node3D = null) -> void:
	if is_dead:
		return
	health -= 1
	if is_attacking:
		is_attacking = false
		anim_tree.set("parameters/attack/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	if from != null:
		var push := global_position - from.global_position
		push.y = 0
		velocity += push.normalized() * 2.5
	if health <= 0:
		die()
	else:
		anim_tree.set("parameters/hit/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)


func die() -> void:
	if is_dead:
		return
	is_dead = true
	health = 0
	is_attacking = false
	anim_tree.set("parameters/state/transition_request", "dead")
	died.emit()


func revive() -> void:
	is_dead = false
	health = max_health
	anim_tree.set("parameters/state/transition_request", "alive")


## Direction vers laquelle le personnage regarde (les modèles glTF regardent vers +Z).
func facing() -> Vector3:
	return visual.global_basis.z.normalized()


func _update_attack(delta: float) -> void:
	if not is_attacking:
		return
	_attack_time += delta
	var length: float = _anim_lengths.get("attack", 1.0)
	if not _attack_hit_done and _attack_time >= length * 0.45:
		_attack_hit_done = true
		for other in get_tree().get_nodes_in_group("characters"):
			var c := other as Character
			if c == null or c == self or c.is_dead:
				continue
			var to := c.global_position - global_position
			to.y = 0
			if to.length() < 2.2 and facing().dot(to.normalized()) > 0.3:
				c.take_hit(self)
	if _attack_time >= length:
		is_attacking = false


func _setup_anim_tree(player: AnimationPlayer, anims: Dictionary) -> void:
	for key in anims:
		_anim_lengths[key] = player.get_animation(anims[key]).length
	for key in ["idle", "walk", "run"]:
		player.get_animation(anims[key]).loop_mode = Animation.LOOP_LINEAR
	for key in ["attack", "hit", "death"]:
		if not anims[key] in [anims["idle"], anims["walk"], anims["run"]]:
			player.get_animation(anims[key]).loop_mode = Animation.LOOP_NONE

	var tree := AnimationNodeBlendTree.new()
	# Locomotion : la vitesse (m/s) choisit le mélange repos/marche/course.
	var loco := AnimationNodeBlendSpace1D.new()
	loco.min_space = 0.0
	loco.max_space = run_speed
	loco.add_blend_point(_anim_node(anims["idle"]), 0.0, -1, "idle")
	loco.add_blend_point(_anim_node(anims["walk"]), walk_speed, -1, "walk")
	loco.add_blend_point(_anim_node(anims["run"]), run_speed, -1, "run")
	tree.add_node("loco", loco)

	var attack_shot := AnimationNodeOneShot.new()
	attack_shot.fadein_time = 0.15
	attack_shot.fadeout_time = 0.3
	tree.add_node("attack", attack_shot)
	tree.add_node("attack_anim", _anim_node(anims["attack"]))

	var hit_shot := AnimationNodeOneShot.new()
	hit_shot.fadein_time = 0.08
	hit_shot.fadeout_time = 0.25
	tree.add_node("hit", hit_shot)
	tree.add_node("hit_anim", _anim_node(anims["hit"]))

	var state := AnimationNodeTransition.new()
	state.xfade_time = 0.3
	state.add_input("alive")
	state.add_input("dead")
	tree.add_node("state", state)
	tree.add_node("death_anim", _anim_node(anims["death"]))

	tree.connect_node("attack", 0, "loco")
	tree.connect_node("attack", 1, "attack_anim")
	tree.connect_node("hit", 0, "attack")
	tree.connect_node("hit", 1, "hit_anim")
	tree.connect_node("state", 0, "hit")
	tree.connect_node("state", 1, "death_anim")
	tree.connect_node("output", 0, "state")

	# L'arbre est placé à côté de l'AnimationPlayer pour partager les mêmes chemins.
	anim_tree = AnimationTree.new()
	anim_tree.name = "AnimationTree"
	anim_tree.tree_root = tree
	player.get_parent().add_child(anim_tree)
	anim_tree.root_node = player.root_node
	anim_tree.anim_player = anim_tree.get_path_to(player)
	anim_tree.active = true
	# Sans cette ligne, la transition n'a aucun état actif au départ.
	anim_tree.set("parameters/state/transition_request", "alive")


func _anim_node(anim_name: String) -> AnimationNodeAnimation:
	var n := AnimationNodeAnimation.new()
	n.animation = anim_name
	return n


func _apply_tint(root: Node) -> void:
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		if mi.mesh == null or mi.material_override != null:
			continue
		for i in mi.mesh.get_surface_count():
			var mat := mi.mesh.surface_get_material(i) as BaseMaterial3D
			if mat == null or mat.albedo_texture != null:
				continue
			var m := mat.duplicate() as BaseMaterial3D
			m.albedo_color = tint
			m.roughness = 0.9
			mi.set_surface_override_material(i, m)
