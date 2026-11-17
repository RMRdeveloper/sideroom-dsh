window.__ModuleLoader__.load({
  id: '@rmrdeveloper/sideroom-dsh',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const { Fragment, useCallback, useEffect, useRef, useState } = React;
    const h = React.createElement;

    const SLOT_NAME = 'conversation.composer.dock';
    const SLOT_ID = 'jev';
    const CHIP_ORDER = 30;
    const CHIP_LABEL = 'Jev';
    const CREDENTIAL_UPDATE_EVENT = 'credentials/reference-updated';
    const LOCALE_NAMESPACE = 'sideroom-jev';
    const DEFAULT_KEY_ENV = 'TYPESAFE_API_KEY';
    const KEY_ENV_LINE = /^keyEnv:[ \t]*(.+?)[ \t]*$/mu;
    const STATUS_COMMAND = '/jev status';
    const CREDENTIAL_SOURCE_ENVIRONMENT = 'env';
    const CREDENTIAL_SOURCE_STORE = 'file';
    const BUSY_SAVE = 'save';
    const BUSY_REMOVE = 'remove';
    const DIALOG_Z_INDEX = 1000;
    const STYLE_MARKER = 'data-sideroom-jev';
    const TITLE_ID = 'sdjev-dialog-title';
    const DESCRIPTION_ID = 'sdjev-dialog-description';
    const KEY_INPUT_ID = 'sdjev-key-input';
    const KEY_ERROR_ID = 'sdjev-key-error';
    const STORE_PHASE = {
      idle: 'idle',
      loading: 'loading',
      ready: 'ready',
      failed: 'failed',
    };
    const DOT_STATE = {
      configured: 'configured',
      missing: 'missing',
      failed: 'failed',
    };
    const PILL_TONE = {
      business: 'business',
      error: 'error',
      neutral: 'neutral',
      success: 'success',
    };
    const STATUS_VIEW = {
      report: 'report',
      text: 'text',
      error: 'error',
      raw: 'raw',
    };
    const REPORT_FIELD_ORDER = [
      'enabled',
      'keyEnv',
      'key',
      'model',
      'status',
      'calls',
      'cutoff',
      'gate',
      'muted',
    ];
    const REPORT_STATUS_FIELD = 'status';
    const REPORT_HINT_FIELD = 'hint';
    const NO_MUTED_RULES = 'none';
    const REPORT_FIELD_LINE = /^([a-z][a-zA-Z0-9]*):[ \t]*(.*)$/u;
    const MONO_FIELDS = new Set(['keyEnv', 'model']);
    const REPORT_ENABLED_TRUE = 'true';
    const REPORT_STATUS_VALUES = {
      ready: 'ready',
      noKey: 'noKey',
      off: 'off',
      quota: 'quota',
      auth: 'auth',
      rateLimited: 'rateLimited',
      unavailable: 'unavailable',
    };
    const REPORT_LABELS = {
      enabled: 'status.fields.enabled',
      keyEnv: 'status.fields.keyEnv',
      key: 'status.fields.key',
      model: 'status.fields.model',
      status: 'status.fields.status',
      calls: 'status.fields.calls',
      cutoff: 'status.fields.cutoff',
      gate: 'status.fields.gate',
      muted: 'status.fields.muted',
    };
    const REPORT_KEY_SOURCE_LABELS = {
      environment: 'key.source.environment',
      credentials: 'key.source.stored',
      missing: 'key.source.missing',
    };
    const REPORT_STATUS_LABELS = {
      [REPORT_STATUS_VALUES.ready]: 'status.state.ready',
      [REPORT_STATUS_VALUES.noKey]: 'status.state.noKey',
      [REPORT_STATUS_VALUES.off]: 'status.state.off',
      [REPORT_STATUS_VALUES.quota]: 'status.state.quota',
      [REPORT_STATUS_VALUES.auth]: 'status.state.auth',
      [REPORT_STATUS_VALUES.rateLimited]: 'status.state.rateLimited',
      [REPORT_STATUS_VALUES.unavailable]: 'status.state.unavailable',
    };
    const REPORT_STATUS_TONES = {
      [REPORT_STATUS_VALUES.ready]: PILL_TONE.success,
      [REPORT_STATUS_VALUES.noKey]: PILL_TONE.error,
      [REPORT_STATUS_VALUES.auth]: PILL_TONE.error,
      [REPORT_STATUS_VALUES.quota]: PILL_TONE.error,
      [REPORT_STATUS_VALUES.unavailable]: PILL_TONE.error,
      [REPORT_STATUS_VALUES.off]: PILL_TONE.neutral,
      [REPORT_STATUS_VALUES.rateLimited]: PILL_TONE.neutral,
    };

    const DICTIONARIES = {
      en: {
        'chip.title.withKey': 'Jev: key configured',
        'chip.title.withoutKey': 'Jev: no key',
        'chip.title.unavailable': 'Jev: key state unavailable',
        'dialog.title': 'Jev settings',
        'dialog.description': 'API key and Host status.',
        'dialog.close': 'Close',
        'key.heading': 'Key',
        'key.loading': 'Reading the key state...',
        'key.fromEnvironment': 'Read from the environment variable {name}.',
        'key.stored': 'Stored credential {name}.',
        'key.storedMasked': 'Stored credential {name} ({masked}).',
        'key.configured': 'A key is configured for {name}.',
        'key.missing': 'No key for {name}.',
        'key.unavailable': 'The key state could not be read.',
        'key.unavailableDetail': 'The key state could not be read: {reason}',
        'key.source.loading': 'Reading',
        'key.source.stored': 'Stored',
        'key.source.environment': 'Environment',
        'key.source.missing': 'Missing',
        'key.source.unavailable': 'Unavailable',
        'key.placeholder': 'Paste the API key',
        'key.save': 'Save key',
        'key.saving': 'Saving...',
        'key.remove': 'Remove',
        'key.removing': 'Removing...',
        'key.show': 'Show',
        'key.hide': 'Hide',
        'key.readOnly': 'The credential store is read-only in this profile.',
        'key.environmentLocked':
          'The key comes from {name}. The environment variable wins, so the stored credential is ignored while it is set.',
        'key.privacy':
          'The Host writes the key to the credential store; it never enters this session or the configuration.',
        'key.saved': 'Key saved.',
        'key.removed': 'Key removed.',
        'key.removeConfirm': 'Remove the stored key from this profile?',
        'key.removeConfirmAction': 'Remove key',
        'key.cancel': 'Cancel',
        'status.heading': 'Status',
        'status.loading': 'Reading the Host status...',
        'status.idle': 'Refresh to read the Host configuration.',
        'status.noSession': 'The status comes from the conversation. Send a message, then refresh.',
        'status.failed': 'The Host did not answer the status command.',
        'status.refresh': 'Refresh',
        'status.refreshing': 'Refreshing...',
        'status.mutedNone': 'None',
        'status.fields.enabled': 'Enabled',
        'status.fields.keyEnv': 'Reference',
        'status.fields.key': 'Source',
        'status.fields.model': 'Model',
        'status.fields.status': 'State',
        'status.fields.calls': 'Calls',
        'status.fields.cutoff': 'Note cutoff',
        'status.fields.gate': 'Global gate',
        'status.fields.muted': 'Muted',
        'status.enabled.true': 'Yes',
        'status.enabled.false': 'No',
        'status.state.ready': 'Ready',
        'status.state.noKey': 'No key',
        'status.state.off': 'Off',
        'status.state.quota': 'Quota exhausted',
        'status.state.auth': 'Key rejected',
        'status.state.rateLimited': 'Rate limited',
        'status.state.unavailable': 'Unavailable',
        'error.template': 'Jev could not {action}: {reason}',
        'error.action.save': 'save the key',
        'error.action.remove': 'remove the key',
      },
      es: {
        'chip.title.withKey': 'Jev: clave configurada',
        'chip.title.withoutKey': 'Jev: sin clave',
        'chip.title.unavailable': 'Jev: estado de la clave no disponible',
        'dialog.title': 'Configuración de Jev',
        'dialog.description': 'Clave de API y estado del Host.',
        'dialog.close': 'Cerrar',
        'key.heading': 'Clave',
        'key.loading': 'Leyendo el estado de la clave...',
        'key.fromEnvironment': 'Se lee de la variable de entorno {name}.',
        'key.stored': 'Credencial guardada {name}.',
        'key.storedMasked': 'Credencial guardada {name} ({masked}).',
        'key.configured': 'Hay una clave configurada para {name}.',
        'key.missing': 'No hay clave para {name}.',
        'key.unavailable': 'No se pudo leer el estado de la clave.',
        'key.unavailableDetail': 'No se pudo leer el estado de la clave: {reason}',
        'key.source.loading': 'Leyendo',
        'key.source.stored': 'Guardada',
        'key.source.environment': 'Entorno',
        'key.source.missing': 'Sin clave',
        'key.source.unavailable': 'No disponible',
        'key.placeholder': 'Pega la clave de API',
        'key.save': 'Guardar clave',
        'key.saving': 'Guardando...',
        'key.remove': 'Quitar',
        'key.removing': 'Quitando...',
        'key.show': 'Mostrar',
        'key.hide': 'Ocultar',
        'key.readOnly': 'El almacén de credenciales es de solo lectura en este perfil.',
        'key.environmentLocked':
          'La clave viene de {name}. La variable de entorno tiene prioridad, así que la credencial guardada se ignora mientras esté definida.',
        'key.privacy':
          'La clave la escribe el Host en el almacén de credenciales; nunca entra a esta sesión ni a la configuración.',
        'key.saved': 'Clave guardada.',
        'key.removed': 'Clave quitada.',
        'key.removeConfirm': '¿Quitar la clave guardada de este perfil?',
        'key.removeConfirmAction': 'Quitar clave',
        'key.cancel': 'Cancelar',
        'status.heading': 'Estado',
        'status.loading': 'Leyendo el estado del Host...',
        'status.idle': 'Actualiza para leer la configuración del Host.',
        'status.noSession': 'El estado se lee de la conversación actual. Envía un mensaje y actualiza.',
        'status.failed': 'El Host no respondió al comando de estado.',
        'status.refresh': 'Actualizar',
        'status.refreshing': 'Actualizando...',
        'status.mutedNone': 'Ninguna',
        'status.fields.enabled': 'Activo',
        'status.fields.keyEnv': 'Referencia',
        'status.fields.key': 'Origen',
        'status.fields.model': 'Modelo',
        'status.fields.status': 'Estado',
        'status.fields.calls': 'Llamadas',
        'status.fields.cutoff': 'Umbral de nota',
        'status.fields.gate': 'Umbral global',
        'status.fields.muted': 'Silenciadas',
        'status.enabled.true': 'Sí',
        'status.enabled.false': 'No',
        'status.state.ready': 'Listo',
        'status.state.noKey': 'Sin clave',
        'status.state.off': 'Desactivado',
        'status.state.quota': 'Cuota agotada',
        'status.state.auth': 'Clave rechazada',
        'status.state.rateLimited': 'Límite alcanzado',
        'status.state.unavailable': 'No disponible',
        'error.template': 'Jev no pudo {action}: {reason}',
        'error.action.save': 'guardar la clave',
        'error.action.remove': 'quitar la clave',
      },
    };

    const STYLE_TEXT = `
.sdjev-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsw-font-xxs-12);line-height:1;cursor:pointer}
.sdjev-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.sdjev-chip[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.sdjev-chip:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.sdjev-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.45}
.sdjev-dot[data-state=${DOT_STATE.configured}]{background:var(--dsw-alias-state-business-primary);opacity:1}
.sdjev-dot[data-state=${DOT_STATE.failed}]{background:var(--dsw-alias-state-error-primary);opacity:1}
.sdjev-root{position:fixed;inset:0;z-index:${DIALOG_Z_INDEX};display:flex;align-items:center;justify-content:center;padding:24px}
.sdjev-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.sdjev-dialog{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;width:min(520px,100%);max-height:calc(100dvh - 48px);overflow:auto;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);font-size:var(--dsw-font-xs-13);line-height:20px}
.sdjev-dialog:focus{outline:none}
.sdjev-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.sdjev-heading-group{display:flex;flex-direction:column;gap:2px;min-width:0}
.sdjev-title{margin:0;font-size:16px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}
.sdjev-description{margin:0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.sdjev-close{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;margin:-4px -6px 0 0;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-size:18px;line-height:1;cursor:pointer}
.sdjev-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sdjev-close:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.sdjev-body{display:flex;flex-direction:column;padding:0 20px 18px}
.sdjev-section{display:flex;flex-direction:column;gap:10px;padding:16px 0}
.sdjev-section+.sdjev-section{border-top:1px solid var(--dsw-alias-border-l2)}
.sdjev-section-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px}
.sdjev-heading{margin:0;font-size:11px;line-height:20px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.sdjev-pill{display:inline-flex;align-items:center;gap:6px;height:20px;padding:0 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1;font-weight:500;white-space:nowrap}
.sdjev-pill-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7}
.sdjev-pill[data-tone=${PILL_TONE.business}]{color:var(--dsw-alias-state-business-primary)}
.sdjev-pill[data-tone=${PILL_TONE.error}]{color:var(--dsw-alias-state-error-primary)}
.sdjev-note{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.sdjev-privacy{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.sdjev-field{position:relative;display:flex}
.sdjev-field[data-reveal=true] .sdjev-input{padding-right:66px}
.sdjev-input{flex:1;min-width:0;box-sizing:border-box;height:36px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.sdjev-input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}
.sdjev-input:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}
.sdjev-input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.sdjev-input:disabled{opacity:.55;cursor:not-allowed}
.sdjev-reveal{position:absolute;top:50%;right:5px;transform:translateY(-50%);height:26px;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;font-weight:500;cursor:pointer}
.sdjev-reveal:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.sdjev-reveal:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:0}
.sdjev-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sdjev-button-spaced{margin-left:auto}
.sdjev-confirm{display:flex;flex-direction:column;gap:8px}
.sdjev-confirm-text{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.sdjev-button{display:inline-flex;align-items:center;justify-content:center;flex:none;height:32px;padding:0 14px;border:1px solid transparent;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-on-color);font:inherit;font-size:12px;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap}
.sdjev-button:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}
.sdjev-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.sdjev-button:disabled{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);opacity:1;cursor:default}
.sdjev-button-quiet{border-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font-weight:500}
.sdjev-button-quiet:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sdjev-button-danger{border-color:var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary);font-weight:500}
.sdjev-button-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sdjev-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.sdjev-success{margin:0;color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.sdjev-fields{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 16px;margin:0;padding:0}
.sdjev-field-row{display:contents}
.sdjev-fields dt{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.sdjev-fields dd{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.sdjev-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px}
.sdjev-value{display:inline-flex;align-items:center;gap:6px}
.sdjev-value-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.sdjev-value[data-tone=${PILL_TONE.success}]{color:var(--dsw-alias-state-success-primary)}
.sdjev-value[data-tone=${PILL_TONE.error}]{color:var(--dsw-alias-state-error-primary)}
.sdjev-empty{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.sdjev-status{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:pre-wrap;overflow-wrap:anywhere}
.sdjev-hint{margin:0;padding:8px 10px;border-left:2px solid var(--dsw-alias-state-business-primary);border-radius:0 var(--dsw-radius-sm) var(--dsw-radius-sm) 0;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.sdjev-refresh{min-width:96px}
@media (max-width:480px){.sdjev-root{padding:12px}.sdjev-dialog{max-height:calc(100dvh - 24px)}.sdjev-actions .sdjev-button{flex:1 1 auto}}
`.trim();

    const EMPTY_STATUS = Object.freeze({
      phase: STORE_PHASE.idle,
      text: undefined,
      error: undefined,
      sessionId: undefined,
    });

    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
    }

    function keyEnvOf(report) {
      const match = KEY_ENV_LINE.exec(report);
      return match === null ? undefined : match[1];
    }

    function ensureStyles() {
      const head = typeof document === 'undefined' ? undefined : document.head;
      if (head === undefined) {
        return;
      }
      if (head.querySelector(`style[${STYLE_MARKER}]`) !== null) {
        return;
      }
      const style = document.createElement('style');
      style.setAttribute(STYLE_MARKER, '');
      style.textContent = STYLE_TEXT;
      head.appendChild(style);
    }

    function createJevStore({ credentials, commands }) {
      let snapshot = {
        phase: STORE_PHASE.loading,
        keyEnv: DEFAULT_KEY_ENV,
        key: undefined,
        error: undefined,
        status: EMPTY_STATUS,
      };
      const listeners = new Set();

      function getSnapshot() {
        return snapshot;
      }

      function subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }

      function publish(patch) {
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners) {
          listener();
        }
      }

      async function readKey() {
        const response = await credentials.describe([snapshot.keyEnv]);
        if (!response.ok) {
          publish({ phase: STORE_PHASE.failed, error: response.error.message });
          return;
        }
        publish({
          phase: STORE_PHASE.ready,
          error: undefined,
          key: response.value[snapshot.keyEnv],
        });
      }

      async function refresh() {
        try {
          await readKey();
        } catch (error) {
          publish({ phase: STORE_PHASE.failed, error: messageOf(error) });
        }
      }

      async function write(operation) {
        try {
          const response = await operation();
          if (!response.ok) {
            return response.error.message;
          }
          await refresh();
          return undefined;
        } catch (error) {
          return messageOf(error);
        }
      }

      function saveKey(value) {
        return write(() => credentials.set(snapshot.keyEnv, value));
      }

      function removeKey() {
        return write(() => credentials.unset(snapshot.keyEnv));
      }

      async function loadStatus(sessionId) {
        if (sessionId === undefined) {
          publish({ status: statusFailure({ sessionId, error: undefined }) });
          return;
        }
        publish({ status: statusLoading({ sessionId, text: snapshot.status.text }) });
        try {
          const response = await commands.execute(sessionId, STATUS_COMMAND);
          if (!response.ok) {
            publish({
              status: statusFailure({ sessionId, error: response.error.message }),
            });
            return;
          }
          const answer = statusAnswerOf(response.value);
          if (answer === undefined || answer.kind !== 'success' || answer.text === undefined) {
            publish({
              status: statusFailure({
                sessionId,
                error: answer === undefined ? undefined : answer.text,
              }),
            });
            return;
          }
          const text = answer.text;
          const previousKeyEnv = snapshot.keyEnv;
          const keyEnv = keyEnvOf(text) ?? previousKeyEnv;
          publish({ status: statusReady({ sessionId, text }), keyEnv });
          if (keyEnv !== previousKeyEnv) {
            await refresh();
          }
        } catch (error) {
          publish({
            status: statusFailure({ sessionId, error: messageOf(error) }),
          });
        }
      }

      return { getSnapshot, subscribe, refresh, saveKey, removeKey, loadStatus };
    }

    function statusLoading({ sessionId, text }) {
      return {
        phase: STORE_PHASE.loading,
        text,
        error: undefined,
        sessionId,
      };
    }

    function statusReady({ sessionId, text }) {
      return {
        phase: STORE_PHASE.ready,
        text,
        error: undefined,
        sessionId,
      };
    }

    function statusFailure({ sessionId, error }) {
      return {
        phase: STORE_PHASE.failed,
        text: undefined,
        error,
        sessionId,
      };
    }

    function statusAnswerOf(execution) {
      if (execution === undefined || execution === null) {
        return undefined;
      }
      return execution.result;
    }

    function chipTitle(t, state) {
      if (state.phase !== STORE_PHASE.ready) {
        return t('chip.title.unavailable');
      }
      return state.key?.configured === true
        ? t('chip.title.withKey')
        : t('chip.title.withoutKey');
    }

    function dotStateOf(state) {
      if (state.phase === STORE_PHASE.failed) {
        return DOT_STATE.failed;
      }
      if (state.key?.configured !== true) {
        return DOT_STATE.missing;
      }
      return DOT_STATE.configured;
    }

    function keySourceText(t, state) {
      if (state.phase === STORE_PHASE.failed) {
        return t('key.unavailable');
      }
      const key = state.key;
      if (key === undefined) {
        return state.phase === STORE_PHASE.loading
          ? t('key.loading')
          : t('key.missing', { name: state.keyEnv });
      }
      if (key.configured !== true) {
        return t('key.missing', { name: state.keyEnv });
      }
      if (key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
        return t('key.fromEnvironment', { name: state.keyEnv });
      }
      if (key.source === CREDENTIAL_SOURCE_STORE) {
        return key.masked === undefined
          ? t('key.stored', { name: state.keyEnv })
          : t('key.storedMasked', { name: state.keyEnv, masked: key.masked });
      }
      return t('key.configured', { name: state.keyEnv });
    }

    function keyPillOf(t, state) {
      if (state.phase === STORE_PHASE.failed) {
        return { tone: PILL_TONE.error, label: t('key.source.unavailable') };
      }
      if (state.phase === STORE_PHASE.loading) {
        return { tone: PILL_TONE.neutral, label: t('key.source.loading') };
      }
      if (state.key?.configured !== true) {
        return { tone: PILL_TONE.neutral, label: t('key.source.missing') };
      }
      if (state.key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
        return { tone: PILL_TONE.business, label: t('key.source.environment') };
      }
      return { tone: PILL_TONE.business, label: t('key.source.stored') };
    }

    function keyLockedByEnvironment(state) {
      return state.key?.source === CREDENTIAL_SOURCE_ENVIRONMENT;
    }

    function keyEditable(state) {
      if (state.phase !== STORE_PHASE.ready) {
        return false;
      }
      if (state.key?.writable === false) {
        return false;
      }
      return !keyLockedByEnvironment(state);
    }

    function parseReport(text) {
      const fields = [];
      let hint;
      for (const rawLine of text.split('\n')) {
        const match = REPORT_FIELD_LINE.exec(rawLine.trim());
        if (match === null) {
          continue;
        }
        const name = match[1];
        const value = match[2].trim();
        if (name === REPORT_HINT_FIELD) {
          hint = value;
          continue;
        }
        fields.push({ name, value });
      }
      if (fields.length === 0) {
        return undefined;
      }
      return { fields, hint };
    }

    function orderedReportFields(fields) {
      const byName = new Map(fields.map((field) => [field.name, field]));
      const known = REPORT_FIELD_ORDER
        .filter((name) => byName.has(name))
        .map((name) => byName.get(name));
      const unknown = fields.filter((field) => !REPORT_FIELD_ORDER.includes(field.name));
      return [...known, ...unknown];
    }

    function translateKnown({ t, labels, value }) {
      if (!Object.hasOwn(labels, value)) {
        return value;
      }
      return t(labels[value]);
    }

    function reportLabelOf(t, name) {
      if (!Object.hasOwn(REPORT_LABELS, name)) {
        return name;
      }
      return t(REPORT_LABELS[name]);
    }

    function reportValueOf(t, field) {
      if (field.name === 'enabled') {
        return field.value === REPORT_ENABLED_TRUE
          ? t('status.enabled.true')
          : t('status.enabled.false');
      }
      if (field.name === 'key') {
        return translateKnown({ t, labels: REPORT_KEY_SOURCE_LABELS, value: field.value });
      }
      if (field.name === REPORT_STATUS_FIELD) {
        return translateKnown({ t, labels: REPORT_STATUS_LABELS, value: field.value });
      }
      if (field.name === 'muted' && field.value === NO_MUTED_RULES) {
        return t('status.mutedNone');
      }
      return field.value;
    }

    function reportToneOf(field) {
      if (field.name !== REPORT_STATUS_FIELD) {
        return PILL_TONE.neutral;
      }
      return REPORT_STATUS_TONES[field.value] ?? PILL_TONE.neutral;
    }

    function reportRowsOf(t, fields) {
      return orderedReportFields(fields).map((field) => ({
        name: field.name,
        label: reportLabelOf(t, field.name),
        value: reportValueOf(t, field),
        tone: reportToneOf(field),
        mono: MONO_FIELDS.has(field.name),
      }));
    }

    function statusErrorView({ t, status }) {
      if (status.error === undefined && status.sessionId === undefined) {
        return { kind: STATUS_VIEW.text, text: t('status.noSession') };
      }
      return { kind: STATUS_VIEW.error, text: t('status.failed'), detail: status.error };
    }

    function statusViewOf({ t, status, sessionId }) {
      if (status.phase === STORE_PHASE.failed) {
        return statusErrorView({ t, status });
      }
      if (status.text !== undefined) {
        const parsed = parseReport(status.text);
        if (parsed === undefined) {
          return { kind: STATUS_VIEW.raw, text: status.text };
        }
        return {
          kind: STATUS_VIEW.report,
          rows: reportRowsOf(t, parsed.fields),
          hint: parsed.hint,
        };
      }
      if (status.phase === STORE_PHASE.loading) {
        return { kind: STATUS_VIEW.text, text: t('status.loading') };
      }
      return {
        kind: STATUS_VIEW.text,
        text: sessionId === undefined ? t('status.noSession') : t('status.idle'),
      };
    }

    function JevChip({ t, sessionId, useJevState, jev }) {
      const state = useJevState((current) => current);
      const [open, setOpen] = useState(false);
      const openDialog = useCallback(() => {
        setOpen(true);
      }, []);
      const closeDialog = useCallback(() => {
        setOpen(false);
      }, []);
      const title = chipTitle(t, state);
      return h(
        Fragment,
        null,
        h(
          'button',
          {
            'type': 'button',
            'className': 'sdjev-chip',
            title,
            'aria-label': title,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'onClick': openDialog,
          },
          h('span', {
            'className': 'sdjev-dot',
            'data-state': dotStateOf(state),
            'aria-hidden': 'true',
          }),
          CHIP_LABEL,
        ),
        open
          ? h(JevDialog, { t, sessionId, state, jev, onClose: closeDialog })
          : null,
      );
    }

    function JevDialog({ t, sessionId, state, jev, onClose }) {
      const dialogRef = useRef(null);

      useDialogFocus({ dialogRef });
      useDialogKeys({ dialogRef, onClose });
      useScrollLock();

      const refresh = useCallback(() => {
        void jev.loadStatus(sessionId);
      }, [jev, sessionId]);

      useEffect(() => {
        if (sessionId === undefined) {
          return;
        }
        const { phase, sessionId: loadedSessionId } = state.status;
        if (phase !== STORE_PHASE.idle && loadedSessionId === sessionId) {
          return;
        }
        void jev.loadStatus(sessionId);
      }, [jev, sessionId, state.status]);

      return createPortal(
        h(
          'div',
          { className: 'sdjev-root' },
          h('div', {
            'className': 'sdjev-mask',
            'onClick': onClose,
            'aria-hidden': 'true',
          }),
          h(
            'div',
            {
              'ref': dialogRef,
              'className': 'sdjev-dialog',
              'role': 'dialog',
              'aria-modal': 'true',
              'aria-labelledby': TITLE_ID,
              'aria-describedby': DESCRIPTION_ID,
              'tabIndex': -1,
            },
            h(
              'header',
              { className: 'sdjev-header' },
              h(
                'div',
                { className: 'sdjev-heading-group' },
                h('h2', { className: 'sdjev-title', id: TITLE_ID }, t('dialog.title')),
                h('p', { className: 'sdjev-description', id: DESCRIPTION_ID }, t('dialog.description')),
              ),
              h(
                'button',
                {
                  'type': 'button',
                  'className': 'sdjev-close',
                  'title': t('dialog.close'),
                  'aria-label': t('dialog.close'),
                  'onClick': onClose,
                },
                '\u00d7',
              ),
            ),
            h(
              'div',
              { className: 'sdjev-body' },
              h(KeyPanel, { t, state, jev, onSaved: refresh }),
              h(StatusPanel, {
                t,
                sessionId,
                status: state.status,
                onRefresh: refresh,
              }),
            ),
          ),
        ),
        document.body,
      );
    }

    function KeyPanel({ t, state, jev, onSaved }) {
      const [draft, setDraft] = useState('');
      const [revealed, setRevealed] = useState(false);
      const [busy, setBusy] = useState(undefined);
      const [failure, setFailure] = useState(undefined);
      const [notice, setNotice] = useState(undefined);
      const [confirmingRemove, setConfirmingRemove] = useState(false);

      const editable = keyEditable(state);
      const saving = busy !== undefined;
      const hasDraft = draft.trim() !== '';

      const save = useCallback(async () => {
        if (saving || !editable || !hasDraft) {
          return;
        }
        setBusy(BUSY_SAVE);
        setFailure(undefined);
        setNotice(undefined);
        const message = await jev.saveKey(draft.trim());
        setBusy(undefined);
        if (message !== undefined) {
          setFailure(
            t('error.template', {
              action: t('error.action.save'),
              reason: message,
            }),
          );
          return;
        }
        setDraft('');
        setRevealed(false);
        setNotice(t('key.saved'));
        onSaved();
      }, [draft, editable, hasDraft, jev, onSaved, saving, t]);

      const remove = useCallback(async () => {
        if (saving) {
          return;
        }
        setBusy(BUSY_REMOVE);
        setFailure(undefined);
        setNotice(undefined);
        const message = await jev.removeKey();
        setBusy(undefined);
        setConfirmingRemove(false);
        if (message !== undefined) {
          setFailure(
            t('error.template', {
              action: t('error.action.remove'),
              reason: message,
            }),
          );
          return;
        }
        setNotice(t('key.removed'));
        onSaved();
      }, [jev, onSaved, saving, t]);

      const cancelRemove = useCallback(() => {
        setConfirmingRemove(false);
      }, []);

      const changeDraft = useCallback((event) => {
        setDraft(event.target.value);
        setFailure(undefined);
        setNotice(undefined);
      }, []);

      const toggleReveal = useCallback(() => {
        setRevealed((current) => !current);
      }, []);

      const onInputKeyDown = useCallback(
        (event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void save();
        },
        [save],
      );

      const pill = keyPillOf(t, state);
      const locked = keyLockedByEnvironment(state);
      const readOnly = state.key?.writable === false;
      const saveDisabled = saving || !editable || !hasDraft;
      const removeDisabled = saving || !editable || state.key?.configured !== true;

      return h(
        'section',
        { className: 'sdjev-section' },
        h(
          'div',
          { className: 'sdjev-section-header' },
          h('h3', { className: 'sdjev-heading' }, t('key.heading')),
          h(
            'span',
            { 'className': 'sdjev-pill', 'data-tone': pill.tone },
            h('span', { 'className': 'sdjev-pill-dot', 'aria-hidden': 'true' }),
            pill.label,
          ),
        ),
        state.phase === STORE_PHASE.failed
          ? h(
              'p',
              { className: 'sdjev-error' },
              state.error === undefined
                ? t('key.unavailable')
                : t('key.unavailableDetail', { reason: state.error }),
            )
          : h('p', { className: 'sdjev-note' }, keySourceText(t, state)),
        editable
          ? h(
              'div',
              { 'className': 'sdjev-field', 'data-reveal': hasDraft },
              h('input', {
                'id': KEY_INPUT_ID,
                'className': 'sdjev-input',
                'type': revealed ? 'text' : 'password',
                'autoComplete': 'off',
                'spellCheck': false,
                'placeholder': t('key.placeholder'),
                'aria-label': t('key.heading'),
                'aria-invalid': failure !== undefined,
                'aria-describedby': failure === undefined ? undefined : KEY_ERROR_ID,
                'value': draft,
                'onChange': changeDraft,
                'onKeyDown': onInputKeyDown,
              }),
              hasDraft
                ? h(
                    'button',
                    {
                      'type': 'button',
                      'className': 'sdjev-reveal',
                      'aria-pressed': revealed,
                      'onClick': toggleReveal,
                    },
                    revealed ? t('key.hide') : t('key.show'),
                  )
                : null,
            )
          : null,
        editable && confirmingRemove
          ? h(
              'div',
              { className: 'sdjev-confirm' },
              h('p', { className: 'sdjev-confirm-text' }, t('key.removeConfirm')),
              h(
                'div',
                { className: 'sdjev-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sdjev-button sdjev-button-danger',
                    onClick: remove,
                    disabled: saving,
                  },
                  busy === BUSY_REMOVE ? t('key.removing') : t('key.removeConfirmAction'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sdjev-button sdjev-button-quiet',
                    onClick: cancelRemove,
                    disabled: saving,
                  },
                  t('key.cancel'),
                ),
              ),
            )
          : null,
        editable && !confirmingRemove
          ? h(
              'div',
              { className: 'sdjev-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'sdjev-button sdjev-button-primary',
                  onClick: save,
                  disabled: saveDisabled,
                },
                busy === BUSY_SAVE ? t('key.saving') : t('key.save'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'sdjev-button sdjev-button-quiet sdjev-button-spaced',
                  onClick: () => {
                    setConfirmingRemove(true);
                  },
                  disabled: removeDisabled,
                },
                t('key.remove'),
              ),
            )
          : null,
        failure === undefined
          ? null
          : h('p', { className: 'sdjev-error', id: KEY_ERROR_ID, role: 'alert' }, failure),
        notice === undefined
          ? null
          : h('p', { className: 'sdjev-success', role: 'status' }, notice),
        !locked && readOnly
          ? h('p', { className: 'sdjev-note' }, t('key.readOnly'))
          : null,
        locked
          ? h('p', { className: 'sdjev-note' }, t('key.environmentLocked', { name: state.keyEnv }))
          : null,
        h('p', { className: 'sdjev-privacy' }, t('key.privacy')),
      );
    }

    function StatusPanel({ t, sessionId, status, onRefresh }) {
      const view = statusViewOf({ t, status, sessionId });
      const refreshing = status.phase === STORE_PHASE.loading;
      return h(
        'section',
        { 'className': 'sdjev-section', 'aria-busy': refreshing },
        h(
          'div',
          { className: 'sdjev-section-header' },
          h('h3', { className: 'sdjev-heading' }, t('status.heading')),
          h(
            'button',
            {
              type: 'button',
              className: 'sdjev-button sdjev-button-quiet sdjev-refresh',
              onClick: onRefresh,
              disabled: refreshing || sessionId === undefined,
            },
            refreshing ? t('status.refreshing') : t('status.refresh'),
          ),
        ),
        statusBodyOf(t, view),
      );
    }

    function statusBodyOf(t, view) {
      if (view.kind === STATUS_VIEW.error) {
        return h(
          'p',
          { className: 'sdjev-error' },
          view.detail === undefined ? view.text : `${view.text} ${view.detail}`,
        );
      }
      if (view.kind === STATUS_VIEW.raw) {
        return h('pre', { className: 'sdjev-status' }, view.text);
      }
      if (view.kind === STATUS_VIEW.text) {
        return h('p', { className: 'sdjev-empty' }, view.text);
      }
      return h(
        Fragment,
        null,
        h(
          'dl',
          { className: 'sdjev-fields' },
          view.rows.map((row) => h(
            'div',
            { key: row.name, className: 'sdjev-field-row' },
            h('dt', null, row.label),
            h('dd', { className: row.mono ? 'sdjev-mono' : undefined }, statusValueOf(row)),
          )),
        ),
        view.hint === undefined
          ? null
          : h('p', { className: 'sdjev-hint' }, view.hint),
      );
    }

    function statusValueOf(row) {
      if (row.name !== REPORT_STATUS_FIELD) {
        return row.value;
      }
      return h(
        'span',
        { 'className': 'sdjev-value', 'data-tone': row.tone },
        h('span', { 'className': 'sdjev-value-dot', 'aria-hidden': 'true' }),
        row.value,
      );
    }

    function useDialogFocus({ dialogRef }) {
      useEffect(() => {
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        if (dialog !== null) {
          dialog.focus();
        }
        return () => {
          if (previous instanceof HTMLElement) {
            previous.focus();
          }
        };
      }, [dialogRef]);
    }

    function useDialogKeys({ dialogRef, onClose }) {
      useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null) {
          return undefined;
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== 'Tab') {
            return;
          }
          const focusable = dialog.querySelectorAll(
            'button:not([disabled]), input:not([disabled])',
          );
          if (focusable.length === 0) {
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        dialog.addEventListener('keydown', onKeyDown);
        return () => {
          dialog.removeEventListener('keydown', onKeyDown);
        };
      }, [dialogRef, onClose]);
    }

    function useScrollLock() {
      useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = previous;
        };
      }, []);
    }

    function followCredentialUpdates({ ctx, store }) {
      ctx.effect(() => {
        try {
          return ctx.remote.$on(CREDENTIAL_UPDATE_EVENT, (ref) => {
            if (ref === store.getSnapshot().keyEnv) {
              void store.refresh();
            }
          });
        } catch (error) {
          console.error(
            'sideroom-dsh: the Jev chip cannot follow credential updates',
            error,
          );
          return () => undefined;
        }
      });
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.credentials', 'remote.commands'],
      apply(ctx) {
        const credentials = {
          describe: (refs) => ctx.remote.credentials.describe(refs),
          set: (ref, value) => ctx.remote.credentials.set(ref, value),
          unset: (ref) => ctx.remote.credentials.unset(ref),
        };
        const commands = {
          execute: (sessionId, line) =>
            ctx.remote.commands.execute(sessionId, line, []),
        };
        const store = createJevStore({ credentials, commands });

        ensureStyles();

        for (const locale of Object.keys(DICTIONARIES)) {
          ctx.effect(() =>
            ctx.locale.register(LOCALE_NAMESPACE, locale, DICTIONARIES[locale]),
          );
        }

        followCredentialUpdates({ ctx, store });

        ctx.effect(() => {
          void store.refresh();
        });

        ctx.slots.inject(SLOT_NAME, () =>
          ctx.slots.register(
            {
              name: SLOT_NAME,
              id: SLOT_ID,
              order: CHIP_ORDER,
              locale: LOCALE_NAMESPACE,
              inject: () => ({ hooks: { jevState: store }, jev: store }),
            },
            JevChip,
          ),
        );
      },
    };
  },
});
