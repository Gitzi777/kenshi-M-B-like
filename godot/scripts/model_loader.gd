class_name ModelLoader
extends RefCounted
## Charge le modèle 3D d'un personnage et ses animations.
##
## - Si un fichier .glb/.gltf/.fbx est présent dans assets/characters/, il sert de corps.
## - Tous les fichiers de assets/animations/ sont ajoutés comme bibliothèques d'animations
##   (ex. « Universal Animation Library » de Quaternius, licence CC0).
## - Si aucun fichier n'est présent, un mannequin provisoire est construit en code
##   pour que le jeu reste jouable.

const CHAR_DIR := "res://assets/characters/"
const ANIM_DIR := "res://assets/animations/"
const MODEL_EXT := ["glb", "gltf", "fbx"]

## Pour chaque animation utile au jeu : mots-clés cherchés dans le nom (par ordre de priorité)
## et mots à éviter. Ainsi, le nom exact dans le fichier n'a pas d'importance.
const ANIM_RULES := {
	"idle": {"want": ["idle_loop", "idle"], "avoid": ["_rm", "sword", "crouch", "swim", "sit", "pistol", "torch"]},
	"walk": {"want": ["walk_loop", "walk_fwd", "walk"], "avoid": ["_rm", "back", "bwd", "left", "right", "carry", "crouch", "formal"]},
	"run": {"want": ["jog_fwd", "jog", "run", "sprint"], "avoid": ["_rm", "back", "bwd", "left", "right", "carry", "crouch"]},
	"attack": {"want": ["sword_attack", "sword_slash", "slash", "sword", "attack", "punch"], "avoid": ["_rm", "idle"]},
	"hit": {"want": ["hit_chest", "hit_", "hit", "damage", "react"], "avoid": ["_rm"]},
	"death": {"want": ["death01", "death", "die", "dying"], "avoid": ["_rm"]},
}

static var _logged := false


## Renvoie {model, player, skeleton, anims} où anims associe "idle", "walk"... au nom réel.
static func load_character() -> Dictionary:
	var char_files := _list_models(CHAR_DIR)
	var anim_files := _list_models(ANIM_DIR)
	if char_files.is_empty() and anim_files.is_empty():
		if not _logged:
			push_warning("Aucun modèle dans assets/ : mannequin provisoire utilisé (voir assets/LISEZMOI.md).")
			_logged = true
		return PlaceholderMannequin.build()

	# Le corps : d'abord assets/characters/, sinon le modèle inclus dans le fichier d'animations.
	var body_path: String = char_files[0] if not char_files.is_empty() else anim_files[0]
	var model := (load(body_path) as PackedScene).instantiate() as Node3D
	var skeleton := _find_first(model, "Skeleton3D") as Skeleton3D
	var player := _find_first(model, "AnimationPlayer") as AnimationPlayer
	if player == null:
		player = AnimationPlayer.new()
		player.name = "AnimationPlayer"
		model.add_child(player)

	# Ajoute les animations des autres fichiers en les « recâblant » sur notre squelette.
	var lib_index := 0
	for path in anim_files:
		if path == body_path or skeleton == null:
			continue
		var lib := _retarget_library(path, model, player, skeleton)
		if lib != null:
			player.add_animation_library("lib%d" % lib_index, lib)
			lib_index += 1

	_normalize_height(model)
	var anims := pick_animations(player.get_animation_list())
	if not _logged:
		print("[ModelLoader] Corps : ", body_path)
		print("[ModelLoader] Animations disponibles : ", player.get_animation_list())
		print("[ModelLoader] Animations choisies : ", anims)
		_logged = true
	return {"model": model, "player": player, "skeleton": skeleton, "anims": anims}


## Choisit, pour chaque action du jeu, l'animation dont le nom correspond le mieux.
static func pick_animations(names: PackedStringArray) -> Dictionary:
	var result := {}
	for key in ANIM_RULES:
		var rule: Dictionary = ANIM_RULES[key]
		var found := ""
		for word in rule["want"]:
			for anim_name in names:
				var low := anim_name.to_lower()
				if not low.contains(word):
					continue
				var bad := false
				for avoid in rule["avoid"]:
					if low.contains(avoid):
						bad = true
						break
				if not bad:
					found = anim_name
					break
			if found != "":
				break
		result[key] = found
	# Si une animation manque, on se rabat sur le repos (ou la première trouvée).
	var fallback: String = result["idle"] if result["idle"] != "" else (names[0] if names.size() > 0 else "")
	for key in result:
		if result[key] == "":
			push_warning("Animation « %s » introuvable, remplacée par « %s »." % [key, fallback])
			result[key] = fallback
	return result


static func _list_models(dir: String) -> PackedStringArray:
	var out := PackedStringArray()
	if not DirAccess.dir_exists_absolute(dir):
		return out
	for file in ResourceLoader.list_directory(dir):
		if file.get_extension().to_lower() in MODEL_EXT:
			out.append(dir + file)
	out.sort()
	return out


static func _find_first(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var found := _find_first(child, type_name)
		if found != null:
			return found
	return null


## Copie les animations d'un autre fichier en réécrivant les chemins des pistes
## pour qu'elles visent le squelette de notre personnage (même nom d'os requis).
static func _retarget_library(path: String, model: Node3D, player: AnimationPlayer, skeleton: Skeleton3D) -> AnimationLibrary:
	var src := (load(path) as PackedScene).instantiate()
	var src_player := _find_first(src, "AnimationPlayer") as AnimationPlayer
	if src_player == null:
		src.free()
		return null
	var root := player.get_node(player.root_node)
	var skel_path := String(root.get_path_to(skeleton))
	var lib := AnimationLibrary.new()
	for anim_name in src_player.get_animation_list():
		var anim := src_player.get_animation(anim_name).duplicate(true) as Animation
		for t in range(anim.get_track_count() - 1, -1, -1):
			var p := anim.track_get_path(t)
			var bone := p.get_concatenated_subnames()
			if bone == "" or skeleton.find_bone(bone) == -1:
				anim.remove_track(t)
				continue
			anim.track_set_path(t, NodePath(skel_path + ":" + bone))
		lib.add_animation(StringName(String(anim_name).get_file()), anim)
	src.free()
	return lib


## Met le personnage à une taille humaine (~1,80 m) si le fichier est à une autre échelle.
static func _normalize_height(model: Node3D) -> void:
	var aabb := AABB()
	var first := true
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var box: AABB = (mi as MeshInstance3D).get_aabb()
		box = (mi as MeshInstance3D).transform * box
		aabb = box if first else aabb.merge(box)
		first = false
	if first or aabb.size.y <= 0.01:
		return
	if aabb.size.y < 1.2 or aabb.size.y > 2.4:
		model.scale *= 1.8 / aabb.size.y
