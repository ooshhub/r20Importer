
let brightRadius, dimRadius, lightAngle, brightVision, dimVision, visionAngle;

let nocheck = true

const ta = {
	light_dimradius: "",
	light_radius: "60",
	light_angle: "0",
	light_hassight: true,
}

brightRadius = (isNaN(ta.light_dimradius) ? parseInt(ta.light_radius, 10)||0 : (ta.light_dimradius < 1) ? 0 : Math.max(0, ( Math.min(parseInt(ta.light_dimradius, 10), parseInt(ta.light_radius, 10)))));
dimRadius = (parseInt(ta.light_radius, 10) <= brightRadius) ? 0 : parseInt(ta.light_radius, 10)||0;
lightAngle = parseInt(ta.light_angle, 10)||0;
if (nocheck || ta.light_hassight) {
	brightVision = brightRadius;
	dimVision = dimRadius;
	visionAngle = lightAngle;
}


console.log(`Bright: ${brightRadius}, Dim: ${dimRadius} //  darkvision: ${dimVision}  (DEVILS: ${brightVision})`);