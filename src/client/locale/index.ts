import { en } from './en';
import { es } from './es';

export const DICTIONARIES = { en, es };

export type LocaleId = keyof typeof DICTIONARIES;
