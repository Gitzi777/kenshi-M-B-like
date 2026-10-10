// Matériau du sol : sable (clair/foncé selon un bruit) et roche sur les pentes,
// avec des strates horizontales comme dans les canyons.
shader_type spatial;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 sand_light : source_color = vec3(0.80, 0.63, 0.43);
uniform vec3 sand_dark : source_color = vec3(0.62, 0.46, 0.31);
uniform vec3 rock_light : source_color = vec3(0.55, 0.41, 0.31);
uniform vec3 rock_dark : source_color = vec3(0.34, 0.25, 0.19);

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float n_big = texture(noise_tex, world_pos.xz * 0.0025).r;
	float n_mid = texture(noise_tex, world_pos.xz * 0.03).r;
	float n_fine = texture(noise_tex, world_pos.xz * 0.4).r;

	vec3 sand = mix(sand_dark, sand_light, clamp(smoothstep(0.3, 0.7, n_big) * 0.75 + n_mid * 0.35, 0.0, 1.0));
	sand *= 0.9 + n_fine * 0.18;

	float slope = 1.0 - world_normal.y;
	float rock_amount = smoothstep(0.16, 0.32, slope + (n_mid - 0.5) * 0.18);
	float strata = sin(world_pos.y * 1.4 + n_mid * 5.0) * 0.5 + 0.5;
	vec3 rock = mix(rock_dark, rock_light, strata * 0.6 + n_fine * 0.4);

	ALBEDO = mix(sand, rock, rock_amount);
	ROUGHNESS = mix(0.96, 0.88, rock_amount);
	SPECULAR = 0.25;
}
