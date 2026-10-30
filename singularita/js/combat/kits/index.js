import { SwordsmanKit } from './swordsman.js';
import { ArcherKit } from './archer.js';
import { MageKit } from './mage.js';
import { AssassinKit } from './assassin.js';
import { StardustKit } from './stardust.js';

const KITS = { swordsman: SwordsmanKit, archer: ArcherKit, mage: MageKit, assassin: AssassinKit, stardust: StardustKit };
export const makeKit = (cls, game) => new KITS[cls](game);
