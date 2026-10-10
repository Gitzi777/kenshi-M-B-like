extends Node3D
## Petite ville fortifiée style « adobe » : enceinte avec porte, tours d'angle,
## maisons à toit plat ou à dôme, un marché. Donne aussi des points de passage aux PNJ.

@export var half_size := 40.0     ## Demi-largeur de l'enceinte (m).
@export var wall_height := 7.0
@export var town_seed := 3

var waypoints: Array[Vector3] = []

var _rng := RandomNumberGenerator.new()


## gate_dir : direction (dans le monde) vers laquelle s'ouvre la porte.
func build(ground_y: float, gate_dir: Vector3) -> void:
	position.y = ground_y
	rotation.y = atan2(gate_dir.x, gate_dir.z)  # la porte est sur le côté +Z local
	_rng.seed = town_seed
	var wall_mat := _mat(Color(0.66, 0.53, 0.4))
	var house_mat := _mat(Color(0.74, 0.62, 0.48))
	var dark_mat := _mat(Color(0.42, 0.33, 0.25))
	var cloth_mat := _mat(Color(0.55, 0.3, 0.2))

	# Enceinte : 4 murs, avec une ouverture de 8 m au milieu du mur +Z (la porte).
	var h := half_size
	var t := 1.6
	var y := wall_height * 0.5 - 1.0
	Builder.add_box(self, Vector3(h * 2 + t, wall_height, t), Vector3(0, y, -h), wall_mat)
	Builder.add_box(self, Vector3(t, wall_height, h * 2), Vector3(-h, y, 0), wall_mat)
	Builder.add_box(self, Vector3(t, wall_height, h * 2), Vector3(h, y, 0), wall_mat)
	var gate := 4.0
	var seg := h - gate
	Builder.add_box(self, Vector3(seg + t * 0.5, wall_height, t), Vector3(-(gate + seg * 0.5), y, h), wall_mat)
	Builder.add_box(self, Vector3(seg + t * 0.5, wall_height, t), Vector3(gate + seg * 0.5, y, h), wall_mat)
	# Tours d'angle et tours de porte.
	for c in [Vector3(-h, 0, -h), Vector3(h, 0, -h), Vector3(-h, 0, h), Vector3(h, 0, h)]:
		Builder.add_cylinder(self, 2.6, wall_height + 3.0, c + Vector3(0, (wall_height + 3.0) * 0.5 - 1.0, 0), wall_mat)
	for side in [-1.0, 1.0]:
		Builder.add_box(self, Vector3(3.0, wall_height + 2.0, 3.0), Vector3(side * (gate + 1.5), (wall_height + 2.0) * 0.5 - 1.0, h), wall_mat)
	# Linteau au-dessus de la porte.
	Builder.add_box(self, Vector3(gate * 2 + 3.0, 1.2, 3.0), Vector3(0, wall_height + 0.4, h), dark_mat)

	# Maisons sur une grille, en laissant une rue centrale vers la porte.
	var slots := [Vector2(-26, -26), Vector2(-26, -6), Vector2(-26, 16), Vector2(26, -26), Vector2(26, -6),
		Vector2(26, 16), Vector2(-10, -28), Vector2(10, -28), Vector2(-12, 22), Vector2(12, 22)]
	for s: Vector2 in slots:
		var w := _rng.randf_range(7.0, 11.0)
		var d := _rng.randf_range(7.0, 10.0)
		var hh := _rng.randf_range(3.5, 6.5)
		Builder.add_box(self, Vector3(w, hh + 1.0, d), Vector3(s.x, hh * 0.5 - 0.5, s.y), house_mat)
		if _rng.randf() < 0.45:
			Builder.add_dome(self, minf(w, d) * 0.4, Vector3(s.x, hh, s.y), house_mat)
		else:
			# Rebord de toit et petite cabane sur le toit.
			Builder.add_box(self, Vector3(w + 0.4, 0.4, d + 0.4), Vector3(s.x, hh + 0.2, s.y), dark_mat)
			if _rng.randf() < 0.5:
				Builder.add_box(self, Vector3(2.5, 2.0, 2.5), Vector3(s.x + w * 0.2, hh + 1.2, s.y - d * 0.2), house_mat)
		# Porte sombre (décor) côté rue.
		var door_x: float = s.x - signf(s.x) * (w * 0.5 + 0.05) if absf(s.x) > 20 else s.x
		var door_z: float = s.y if absf(s.x) > 20 else s.y - signf(s.y) * (d * 0.5 + 0.05)
		var door := MeshInstance3D.new()
		var dm := BoxMesh.new()
		dm.size = Vector3(1.4, 2.2, 1.4) if absf(s.x) > 20 else Vector3(1.4, 2.2, 0.2)
		door.mesh = dm
		door.material_override = dark_mat
		door.position = Vector3(door_x, 1.1, door_z)
		add_child(door)

	# Marché : quelques étals avec des toiles.
	for i in 3:
		var p := Vector3(-6.0 + i * 6.0, 0, -4.0)
		for corner in [Vector3(-1.2, 0, -1.0), Vector3(1.2, 0, -1.0), Vector3(-1.2, 0, 1.0), Vector3(1.2, 0, 1.0)]:
			Builder.add_box(self, Vector3(0.15, 2.4, 0.15), p + corner + Vector3(0, 1.2, 0), dark_mat)
		Builder.add_box(self, Vector3(2.8, 0.08, 2.4), p + Vector3(0, 2.45, 0), cloth_mat)
		Builder.add_box(self, Vector3(2.2, 0.9, 1.0), p + Vector3(0, 0.45, 0.4), dark_mat)

	# Points de passage pour les PNJ (dans les rues), convertis en coordonnées du monde.
	var local_points := [Vector3(0, 0, 30), Vector3(0, 0, 12), Vector3(0, 0, 4), Vector3(-14, 0, 6),
		Vector3(14, 0, 6), Vector3(-14, 0, -14), Vector3(14, 0, -14), Vector3(0, 0, -16),
		Vector3(-6, 0, 32), Vector3(6, 0, 32), Vector3(0, 0, 50)]
	for lp in local_points:
		waypoints.append(to_global(lp))


func _mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.95
	var tex := NoiseTexture2D.new()
	var nz := FastNoiseLite.new()
	nz.frequency = 0.08
	nz.fractal_octaves = 4
	tex.noise = nz
	tex.seamless = true
	var ramp := Gradient.new()
	ramp.set_color(0, Color(0.82, 0.8, 0.78))
	ramp.set_color(1, Color(1, 1, 1))
	tex.color_ramp = ramp
	m.albedo_texture = tex
	m.uv1_triplanar = true
	m.uv1_scale = Vector3.ONE * 0.15
	return m
