extends Character
## Le personnage contrôlé par le joueur (ZQSD / flèches, Maj pour courir, clic pour frapper).


func _ready() -> void:
	super()
	add_to_group("player")


func _physics_process(delta: float) -> void:
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		# Les déplacements sont relatifs à la caméra.
		var fwd := -cam.global_basis.z
		fwd.y = 0
		var right := cam.global_basis.x
		right.y = 0
		move_input = right.normalized() * input.x - fwd.normalized() * input.y
	wants_run = Input.is_action_pressed("run")
	if Input.is_action_just_pressed("attack") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		attack()
	# Touches de test pour voir les animations.
	if Input.is_action_just_pressed("debug_hit"):
		take_hit()
	if Input.is_action_just_pressed("debug_die"):
		die()
	if Input.is_action_just_pressed("debug_revive"):
		revive()
	super(delta)
