export type GraphicsQuality='low'|'balanced'|'high';
export const GRAPHICS={low:{pixelRatio:.85,shadows:false,shadowSize:512,detail:.55},balanced:{pixelRatio:1.25,shadows:true,shadowSize:512,detail:.8},high:{pixelRatio:1.7,shadows:true,shadowSize:1024,detail:1}};
export const QUALITY_KEY='little-elsewhere-graphics';
export function qualityOrDefault(value:unknown):GraphicsQuality{return value==='low'||value==='high'?value:'balanced';}
