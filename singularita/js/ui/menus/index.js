import { inventoryTab } from './inventory.js';
import { craftingTab } from './crafting.js';
import { characterTab } from './character.js';
import { skillsTab } from './skills.js';
import { mapTab } from './map.js';
import { journalTab } from './journal.js';
import { settingsTab } from './settings.js';
import { systemTab } from './system.js';
import { debugTab } from './debug.js';

export const MENU_TABS = [
  { id: 'inventory', name: 'Inventory', icon: '▣' }, { id: 'craft', name: 'Crafting', icon: '⚒' }, { id: 'character', name: 'Character', icon: '☺' },
  { id: 'skills', name: 'Skills', icon: '✦' }, { id: 'map', name: 'Map', icon: '⌖' }, { id: 'journal', name: 'Journal', icon: '✎' },
  { id: 'settings', name: 'Settings', icon: '⚙' }, { id: 'system', name: 'System', icon: '☰' },
  // Only for a character named "DeBug" (systems/debug.js).
  { id: 'debug', name: 'Dev', icon: '⚑', debugOnly: true },
];
export const MENUS = { inventory: inventoryTab, craft: craftingTab, character: characterTab, skills: skillsTab, map: mapTab, journal: journalTab, settings: settingsTab, system: systemTab, debug: debugTab };
