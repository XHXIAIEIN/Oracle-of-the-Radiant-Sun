/* Mode rule definitions, keyed by id. User-facing copy lives in data/lang/*.json. */

import sunyear from './sunyear.js';
import horary from './horary.js';
import trine from './trine.js';
import cross from './cross.js';
import single from './single.js';

export const MODE_ORDER = ['single', 'horary', 'trine', 'cross', 'sunyear'];
export const MODES = { sunyear, horary, trine, cross, single };
