class_name PlaceholderMannequin
extends RefCounted
## Mannequin PROVISOIRE (formes simples + animations faites à la main).
## Il sert seulement tant que les vrais modèles Quaternius ne sont pas dans assets/.

const SKIN := Color(0.72, 0.55, 0.42)
const CLOTH := Color(0.55, 0.45, 0.33)


static func build() -> Dictionary:
	var root := Node3D.new()
	root.name = "Mannequin"
	var hips := _pivot(root, "Hips", Vector3(0, 0.95, 0))
	var torso := _pivot(hips, "Torso", Vector3.ZERO)
	_part(torso, CapsuleMesh, Vector3(0, 0.27, 0), Vector3(0.36, 0.62, 0.22), CLOTH)
	var head := _pivot(torso, "Head", Vector3(0, 0.6, 0))
	_part(head, SphereMesh, Vector3(0, 0.1, 0), Vector3(0.21, 0.25, 0.23), SKIN)
	for side in [-1.0, 1.0]:
		var s := "L" if side < 0 else "R"
		var arm := _pivot(torso, "Arm" + s, Vector3(0.22 * side, 0.5, 0))
		_part(arm, CapsuleMesh, Vector3(0, -0.3, 0), Vector3(0.1, 0.62, 0.1), CLOTH)
		var leg := _pivot(hips, "Leg" + s, Vector3(0.1 * side, 0, 0))
		_part(leg, CapsuleMesh, Vector3(0, -0.46, 0), Vector3(0.14, 0.94, 0.14), CLOTH.darkened(0.25))
	# Épée dans la main droite.
	var sword := MeshInstance3D.new()
	var blade := BoxMesh.new()
	blade.size = Vector3(0.04, 0.9, 0.012)
	sword.mesh = blade
	sword.position = Vector3(0, -0.62, 0.38)
	sword.rotation_degrees = Vector3(90, 0, 0)
	sword.material_override = _mat(Color(0.6, 0.6, 0.58), 0.4, 0.8)
	torso.get_node("ArmR").add_child(sword)

	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"
	root.add_child(player)
	var lib := AnimationLibrary.new()
	lib.add_animation("idle", _idle())
	lib.add_animation("walk", _walk(1.0, 0.45, 0.35, 0.0))
	lib.add_animation("run", _walk(0.62, 0.85, 0.75, 0.18))
	lib.add_animation("attack", _attack())
	lib.add_animation("hit", _hit())
	lib.add_animation("death", _death())
	player.add_animation_library("", lib)
	var anims := {"idle": "idle", "walk": "walk", "run": "run", "attack": "attack", "hit": "hit", "death": "death"}
	return {"model": root, "player": player, "skeleton": null, "anims": anims}


static func _pivot(parent: Node3D, n: String, pos: Vector3) -> Node3D:
	var p := Node3D.new()
	p.name = n
	p.position = pos
	parent.add_child(p)
	return p


static func _part(parent: Node3D, mesh_type, pos: Vector3, size: Vector3, color: Color) -> void:
	var mi := MeshInstance3D.new()
	var mesh: PrimitiveMesh = mesh_type.new()
	if mesh is CapsuleMesh:
		mesh.radius = 0.5
		mesh.height = 1.0
		mi.scale = Vector3(size.x, size.y, size.z)
	elif mesh is SphereMesh:
		mesh.radius = 0.5
		mesh.height = 1.0
		mi.scale = size
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = _mat(color, 0.9, 0.0)
	parent.add_child(mi)


static func _mat(color: Color, rough: float, metal: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


## Ajoute une piste « rotation » (ou autre propriété) avec des clés [temps, valeur].
static func _track(anim: Animation, path: String, keys: Array) -> void:
	var t := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t, NodePath(path))
	anim.track_set_interpolation_type(t, Animation.INTERPOLATION_CUBIC)
	for k in keys:
		anim.track_insert_key(t, k[0], k[1])


static func _idle() -> Animation:
	var a := Animation.new()
	a.length = 2.4
	a.loop_mode = Animation.LOOP_LINEAR
	_track(a, "Hips:position", [[0.0, Vector3(0, 0.95, 0)], [1.2, Vector3(0, 0.94, 0)], [2.4, Vector3(0, 0.95, 0)]])
	_track(a, "Hips/Torso:rotation", [[0.0, Vector3(0.02, 0, 0)], [1.2, Vector3(0.05, 0, 0)], [2.4, Vector3(0.02, 0, 0)]])
	_track(a, "Hips/Torso/ArmL:rotation", [[0.0, Vector3(0, 0, -0.08)], [2.4, Vector3(0, 0, -0.08)]])
	_track(a, "Hips/Torso/ArmR:rotation", [[0.0, Vector3(0, 0, 0.08)], [2.4, Vector3(0, 0, 0.08)]])
	return a


static func _walk(length: float, leg: float, arm: float, lean: float) -> Animation:
	var a := Animation.new()
	a.length = length
	a.loop_mode = Animation.LOOP_LINEAR
	var h := length * 0.5
	var q := length * 0.25
	_track(a, "Hips/LegL:rotation", [[0.0, Vector3(leg, 0, 0)], [h, Vector3(-leg, 0, 0)], [length, Vector3(leg, 0, 0)]])
	_track(a, "Hips/LegR:rotation", [[0.0, Vector3(-leg, 0, 0)], [h, Vector3(leg, 0, 0)], [length, Vector3(-leg, 0, 0)]])
	_track(a, "Hips/Torso/ArmL:rotation", [[0.0, Vector3(-arm, 0, -0.08)], [h, Vector3(arm, 0, -0.08)], [length, Vector3(-arm, 0, -0.08)]])
	_track(a, "Hips/Torso/ArmR:rotation", [[0.0, Vector3(arm, 0, 0.08)], [h, Vector3(-arm, 0, 0.08)], [length, Vector3(arm, 0, 0.08)]])
	_track(a, "Hips/Torso:rotation", [[0.0, Vector3(lean, 0, 0)], [length, Vector3(lean, 0, 0)]])
	_track(a, "Hips:position", [[0.0, Vector3(0, 0.93, 0)], [q, Vector3(0, 0.97, 0)], [h, Vector3(0, 0.93, 0)], [h + q, Vector3(0, 0.97, 0)], [length, Vector3(0, 0.93, 0)]])
	return a


static func _attack() -> Animation:
	var a := Animation.new()
	a.length = 0.9
	_track(a, "Hips/Torso/ArmR:rotation", [[0.0, Vector3(0, 0, 0.08)], [0.3, Vector3(2.7, 0, 0.3)], [0.5, Vector3(-0.6, 0, -0.2)], [0.9, Vector3(0, 0, 0.08)]])
	_track(a, "Hips/Torso:rotation", [[0.0, Vector3(0, 0, 0)], [0.3, Vector3(-0.1, 0.5, 0)], [0.5, Vector3(0.25, -0.4, 0)], [0.9, Vector3(0, 0, 0)]])
	_track(a, "Hips/LegL:rotation", [[0.0, Vector3.ZERO], [0.4, Vector3(-0.4, 0, 0)], [0.9, Vector3.ZERO]])
	_track(a, "Hips/LegR:rotation", [[0.0, Vector3.ZERO], [0.4, Vector3(0.3, 0, 0)], [0.9, Vector3.ZERO]])
	return a


static func _hit() -> Animation:
	var a := Animation.new()
	a.length = 0.6
	_track(a, "Hips/Torso:rotation", [[0.0, Vector3.ZERO], [0.12, Vector3(-0.45, 0.2, 0)], [0.6, Vector3.ZERO]])
	_track(a, "Hips/Torso/Head:rotation", [[0.0, Vector3.ZERO], [0.12, Vector3(-0.4, 0, 0)], [0.6, Vector3.ZERO]])
	return a


static func _death() -> Animation:
	var a := Animation.new()
	a.length = 1.3
	_track(a, "Hips:position", [[0.0, Vector3(0, 0.95, 0)], [0.5, Vector3(0, 0.6, -0.2)], [1.0, Vector3(0, 0.15, -0.7)], [1.3, Vector3(0, 0.12, -0.75)]])
	_track(a, "Hips:rotation", [[0.0, Vector3.ZERO], [0.5, Vector3(-0.3, 0, 0)], [1.0, Vector3(-1.5, 0, 0)], [1.3, Vector3(-1.55, 0, 0)]])
	_track(a, "Hips/LegL:rotation", [[0.0, Vector3.ZERO], [0.5, Vector3(1.0, 0, 0)], [1.0, Vector3(0.3, 0, 0)]])
	_track(a, "Hips/LegR:rotation", [[0.0, Vector3.ZERO], [0.5, Vector3(1.2, 0, 0)], [1.0, Vector3(0.1, 0, 0)]])
	_track(a, "Hips/Torso/ArmL:rotation", [[0.0, Vector3.ZERO], [1.0, Vector3(-2.5, 0, -0.6)]])
	_track(a, "Hips/Torso/ArmR:rotation", [[0.0, Vector3.ZERO], [1.0, Vector3(-2.3, 0, 0.6)]])
	return a
