extends Node3D
## Disperse sur le terrain : rochers (avec collision pour les gros), arbustes secs, ruines.

@export var rock_count := 1400
@export var shrub_count := 4000
@export var ruin_count := 14
@export var scatter_seed := 7

## Zones à laisser vides (villes, départ) : Vector3(x, z, rayon).
var keep_clear: Array[Vector3] = []

var _rng := RandomNumberGenerator.new()
var _terrain: Terrain


func populate(terrain: Terrain) -> void:
	_terrain = terrain
	_rng.seed = scatter_seed
	var rock_mat := _material(Color(0.5, 0.39, 0.3), 0.95)
	var shrub_mat := _material(Color(0.36, 0.33, 0.2), 1.0)
	for v in 3:
		_scatter_rocks(_make_rock_mesh(v, 0.22), rock_mat, rock_count / 3)
	_scatter_shrubs(_make_rock_mesh(10, 0.35), shrub_mat)
	_scatter_ruins()


func _material(color: Color, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	var tex := NoiseTexture2D.new()
	var nz := FastNoiseLite.new()
	nz.frequency = 0.05
	tex.noise = nz
	tex.seamless = true
	m.albedo_texture = tex
	m.uv1_triplanar = true
	m.uv1_scale = Vector3.ONE * 0.4
	return m


## Rocher : une sphère déformée par du bruit puis écrasée par le bas.
func _make_rock_mesh(variant: int, bumpiness: float) -> ArrayMesh:
	var sphere := SphereMesh.new()
	sphere.radial_segments = 16
	sphere.rings = 10
	var arrays := sphere.get_mesh_arrays()
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var nz := FastNoiseLite.new()
	nz.seed = variant * 31 + 5
	nz.frequency = 1.6
	for i in verts.size():
		var v := verts[i]
		v *= 1.0 + nz.get_noise_3dv(v * 2.0) * bumpiness * 2.0
		v.y = maxf(v.y, -0.15) * 0.75
		verts[i] = v
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	for i in idx:
		st.add_vertex(verts[i])
	st.generate_normals()
	return st.commit()


func _random_spot(margin: float) -> Vector3:
	var half := _terrain.size * 0.5 * 0.8
	for attempt in 20:
		var x := _rng.randf_range(-half, half)
		var z := _rng.randf_range(-half, half)
		var ok := true
		for zone in keep_clear:
			if Vector2(x - zone.x, z - zone.y).length() < zone.z + margin:
				ok = false
				break
		if ok:
			return Vector3(x, _terrain.get_height(x, z), z)
	return Vector3.INF


func _scatter_rocks(mesh: ArrayMesh, mat: Material, count: int) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	var xforms: Array[Transform3D] = []
	for i in count:
		var p := _random_spot(4.0)
		if p == Vector3.INF:
			continue
		# Plus de rochers dans les pentes (pied des falaises).
		var slope := 1.0 - _terrain.get_normal(p.x, p.z).y
		if slope < 0.05 and _rng.randf() < 0.6:
			continue
		var s := _rng.randf_range(0.4, 2.0) * (1.0 + slope * 4.0)
		if _rng.randf() < 0.05:
			s *= 3.0
		var b := Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(s, s * _rng.randf_range(0.6, 1.1), s * _rng.randf_range(0.7, 1.3)))
		xforms.append(Transform3D(b, p + Vector3.DOWN * s * 0.15))
		if s > 1.2:
			_add_rock_collision(p, s)
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	_add_multimesh(mm, mat)


func _add_rock_collision(p: Vector3, s: float) -> void:
	var body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = s * 0.8
	col.shape = shape
	body.add_child(col)
	body.position = p
	add_child(body)


func _scatter_shrubs(mesh: ArrayMesh, mat: Material) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	var xforms: Array[Transform3D] = []
	for i in shrub_count:
		var p := _random_spot(2.0)
		if p == Vector3.INF or _terrain.get_normal(p.x, p.z).y < 0.9:
			continue
		var s := _rng.randf_range(0.25, 0.7)
		var b := Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(s, s * 0.8, s))
		xforms.append(Transform3D(b, p))
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	_add_multimesh(mm, mat)


func _add_multimesh(mm: MultiMesh, mat: Material) -> void:
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)


## Ruines : morceaux de murs en terre cuite, cassés et à moitié enterrés.
func _scatter_ruins() -> void:
	var mat := _material(Color(0.62, 0.5, 0.38), 0.95)
	for i in ruin_count:
		var p := _random_spot(30.0)
		if p == Vector3.INF:
			continue
		var ruin := Node3D.new()
		ruin.position = p
		ruin.rotation.y = _rng.randf() * TAU
		add_child(ruin)
		for w in _rng.randi_range(2, 5):
			var size := Vector3(_rng.randf_range(2.0, 7.0), _rng.randf_range(0.8, 4.5), 0.8)
			var pos := Vector3(_rng.randf_range(-6, 6), size.y * 0.5 - 0.6, _rng.randf_range(-6, 6))
			Builder.add_box(ruin, size, pos, mat, _rng.randf_range(-0.4, 0.4) + (PI * 0.5 if w % 2 == 0 else 0.0))
