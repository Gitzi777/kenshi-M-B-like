class_name Terrain
extends Node3D
## Grand terrain désertique généré par du bruit : collines, dunes allongées,
## plateaux rocheux (mesas) et montagnes sur les bords pour fermer la carte.

@export var size := 2048.0            ## Taille du terrain en mètres (côté).
@export var resolution := 512         ## Nombre de cases par côté (plus = plus détaillé, plus lent).
@export var terrain_seed := 1337

## Zones aplanies (villes, point de départ) : Vector3(x, z, rayon).
var flat_zones: Array[Vector3] = []

var _cell := 4.0
var _heights := PackedFloat32Array()
var _n_hills := FastNoiseLite.new()
var _n_dunes := FastNoiseLite.new()
var _n_mask := FastNoiseLite.new()
var _n_mesa := FastNoiseLite.new()
var _flat_heights: Array[float] = []


func generate() -> void:
	var t0 := Time.get_ticks_msec()
	_cell = size / resolution
	_setup_noise()
	_flat_heights.clear()
	for zone in flat_zones:
		_flat_heights.append(_raw_height(zone.x, zone.y))

	var n := resolution + 1
	_heights.resize(n * n)
	for zi in n:
		for xi in n:
			_heights[zi * n + xi] = _height(-size * 0.5 + xi * _cell, -size * 0.5 + zi * _cell)
	_build_mesh(n)
	_build_collision(n)
	print("[Terrain] généré en %d ms" % (Time.get_ticks_msec() - t0))


## Hauteur du sol à une position (x, z) du monde.
func get_height(x: float, z: float) -> float:
	var n := resolution + 1
	var fx := clampf((x + size * 0.5) / _cell, 0.0, resolution - 0.001)
	var fz := clampf((z + size * 0.5) / _cell, 0.0, resolution - 0.001)
	var xi := int(fx)
	var zi := int(fz)
	var tx := fx - xi
	var tz := fz - zi
	var h00 := _heights[zi * n + xi]
	var h10 := _heights[zi * n + xi + 1]
	var h01 := _heights[(zi + 1) * n + xi]
	var h11 := _heights[(zi + 1) * n + xi + 1]
	return lerpf(lerpf(h00, h10, tx), lerpf(h01, h11, tx), tz)


## Normale du sol (pour savoir si c'est une pente).
func get_normal(x: float, z: float) -> Vector3:
	var e := _cell
	return Vector3(get_height(x - e, z) - get_height(x + e, z), 2.0 * e, get_height(x, z - e) - get_height(x, z + e)).normalized()


func _setup_noise() -> void:
	_n_hills.seed = terrain_seed
	_n_hills.frequency = 0.0012
	_n_hills.fractal_octaves = 4
	_n_dunes.seed = terrain_seed + 1
	_n_dunes.frequency = 0.012
	_n_dunes.fractal_octaves = 2
	_n_mask.seed = terrain_seed + 2
	_n_mask.frequency = 0.002
	_n_mesa.seed = terrain_seed + 3
	_n_mesa.frequency = 0.0025
	_n_mesa.fractal_octaves = 3


func _raw_height(x: float, z: float) -> float:
	var h := _n_hills.get_noise_2d(x, z) * 38.0
	# Dunes : crêtes allongées (bruit étiré + valeur absolue inversée).
	var d := _n_dunes.get_noise_2d(x * 0.45 + z * 0.2, z * 1.1)
	var dunes := pow(1.0 - absf(d), 3.0) * 6.5
	var dune_mask := clampf(_n_mask.get_noise_2d(x, z) * 2.5 + 0.4, 0.0, 1.0)
	h += dunes * dune_mask
	# Mesas : plateaux rocheux à bords raides et en terrasses.
	var m := _n_mesa.get_noise_2d(x, z)
	var mesa := smoothstep(0.32, 0.4, m) * 28.0 + smoothstep(0.5, 0.56, m) * 14.0
	h += mesa * (1.0 - dune_mask * 0.6)
	# Montagnes sur les bords de la carte.
	var edge := maxf(absf(x), absf(z)) / (size * 0.5)
	h += smoothstep(0.78, 1.0, edge) * 160.0 * (0.7 + 0.3 * _n_hills.get_noise_2d(z * 3.0, x * 3.0))
	return h


func _height(x: float, z: float) -> float:
	var h := _raw_height(x, z)
	for i in flat_zones.size():
		var zone := flat_zones[i]
		var dist := Vector2(x - zone.x, z - zone.y).length()
		var t := smoothstep(zone.z, zone.z * 1.8, dist)
		h = lerpf(_flat_heights[i], h, t)
	return h


func _build_mesh(n: int) -> void:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	verts.resize(n * n)
	normals.resize(n * n)
	uvs.resize(n * n)
	for zi in n:
		for xi in n:
			var i := zi * n + xi
			var x := -size * 0.5 + xi * _cell
			var z := -size * 0.5 + zi * _cell
			verts[i] = Vector3(x, _heights[i], z)
			var hl := _heights[i - 1] if xi > 0 else _heights[i]
			var hr := _heights[i + 1] if xi < n - 1 else _heights[i]
			var hd := _heights[i - n] if zi > 0 else _heights[i]
			var hu := _heights[i + n] if zi < n - 1 else _heights[i]
			normals[i] = Vector3(hl - hr, 2.0 * _cell, hd - hu).normalized()
			uvs[i] = Vector2(x, z) / 8.0
	var indices := PackedInt32Array()
	indices.resize(resolution * resolution * 6)
	var k := 0
	for zi in resolution:
		for xi in resolution:
			var a := zi * n + xi
			indices[k] = a
			indices[k + 1] = a + 1
			indices[k + 2] = a + n
			indices[k + 3] = a + 1
			indices[k + 4] = a + n + 1
			indices[k + 5] = a + n
			k += 6
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)

	var noise_tex := NoiseTexture2D.new()
	noise_tex.width = 512
	noise_tex.height = 512
	noise_tex.seamless = true
	noise_tex.generate_mipmaps = true
	var tn := FastNoiseLite.new()
	tn.frequency = 0.01
	tn.fractal_octaves = 5
	noise_tex.noise = tn
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/terrain.gdshader")
	mat.set_shader_parameter("noise_tex", noise_tex)

	var mi := MeshInstance3D.new()
	mi.name = "TerrainMesh"
	mi.mesh = mesh
	mi.material_override = mat
	add_child(mi)


func _build_collision(n: int) -> void:
	# HeightMapShape3D : une valeur par sommet ; on met tout à l'échelle de la taille des cases.
	var shape := HeightMapShape3D.new()
	shape.map_width = n
	shape.map_depth = n
	var data := PackedFloat32Array()
	data.resize(n * n)
	for i in n * n:
		data[i] = _heights[i] / _cell
	shape.map_data = data
	var body := StaticBody3D.new()
	body.name = "TerrainBody"
	var col := CollisionShape3D.new()
	col.shape = shape
	col.scale = Vector3.ONE * _cell
	body.add_child(col)
	add_child(body)
