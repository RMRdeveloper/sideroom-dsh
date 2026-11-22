import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
import type { KeyTone } from '../model/key-view';
import type { PillTone } from '../model/report';

export const PILL_TONE_STATE: Record<PillTone, StateDotState> = {
  business: 'ongoing',
  error: 'error',
  neutral: 'idle',
  success: 'done',
};

export const KEY_TONE_STATE: Record<KeyTone, StateDotState> = {
  ok: 'done',
  missing: 'warning',
  failed: 'error',
  loading: 'ongoing',
};
