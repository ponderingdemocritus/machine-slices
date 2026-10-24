// The world: everything about the machine that depends only on the seed. It is built once per seed, is
// plain data (no canvas, no DOM), and never changes; motion is computed from it and the clock at draw
// time. Each part draws from its own random stream (engine/random.ts).

import { WORLD_SIZE } from "../engine/validate.js";
import { seedWords, stream } from "../engine/random.js";
import { designGears, type GearWorks } from "./gears.js";
import { designHeart, type Heart } from "./heart.js";
import { connectOrgans, placeOrgans, type Organ } from "./organs.js";
import { choosePalette, type Palette } from "./palette.js";
import { growTissue, type Cell } from "./tissue.js";
import { growVessels, VesselField, type Vessels } from "./vessels.js";

/** How fast a pulse travels down the vessels, in world units per millisecond. */
export const PULSE_SPEED = 0.62;
/** Length of a pulse along its vessel, in world units. */
export const PULSE_LENGTH = 96;

export interface World {
  seedHex: string;
  palette: Palette;
  tissue: Cell[];
  heart: Heart;
  organs: Organ[];
  vessels: Vessels;
  works: GearWorks;
}

export function buildWorld(seedHex: string): World {
  const words = seedWords(seedHex);
  const centre = WORLD_SIZE / 2;
  const palette = choosePalette(stream(words, "palette"));
  const tissue = growTissue(stream(words, "tissue"));
  const heart = designHeart(stream(words, "heart"), centre, centre);
  const organs = placeOrgans(stream(words, "organs"), heart);
  const vessels = growVessels(stream(words, "vessels"), heart, organs);
  connectOrgans(organs, vessels, PULSE_SPEED);
  const works = designGears(stream(words, "gears"), heart, organs, vessels, new VesselField(vessels, 6), PULSE_SPEED);
  return { seedHex, palette, tissue, heart, organs, vessels, works };
}
