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

    const DICTIONARIES = {
      en: {
        'chip.title.withKey': 'Jev: key configured',
        'chip.title.withoutKey': 'Jev: no key',
        'chip.title.unavailable': 'Jev: key state unavailable',
        'dialog.title': 'Jev review',
        'dialog.close': 'Close',
        'key.heading': 'Key',
        'key.loading': 'Reading the key state...',
        'key.fromEnvironment': 'Read from the environment variable {name}.',
        'key.stored': 'Stored credential {name}.',
        'key.storedMasked': 'Stored credential {name} ({masked}).',
        'key.configured': 'A key is configured for {name}.',
        'key.missing': 'No key for {name}.',
        'key.unavailable': 'The key state could not be read.',
        'key.placeholder': 'Paste the key',
        'key.save': 'Save key',
        'key.saving': 'Saving...',
        'key.remove': 'Remove key',
        'key.removing': 'Removing...',
        'key.empty': 'Enter a key before saving.',
        'key.readOnly': 'The credential store is read-only in this profile.',
        'key.privacy':
          'The Host writes the key to the credential store; it never enters this session or the configuration.',
        'status.heading': 'Status',
        'status.loading': 'Reading the Host status...',
        'status.idle': 'Refresh to read the Host configuration.',
        'status.failed': 'The Host did not answer the status command.',
        'status.refresh': 'Refresh',
        'error.template': 'Jev could not {action}: {reason}',
        'error.action.save': 'save the key',
        'error.action.remove': 'remove the key',
      },
      es: {
        'chip.title.withKey': 'Jev: clave configurada',
        'chip.title.withoutKey': 'Jev: sin clave',
        'chip.title.unavailable': 'Jev: estado de la clave no disponible',
        'dialog.title': 'Revisión Jev',
        'dialog.close': 'Cerrar',
        'key.heading': 'Clave',
        'key.loading': 'Leyendo el estado de la clave...',
        'key.fromEnvironment': 'Se lee de la variable de entorno {name}.',
        'key.stored': 'Credencial guardada {name}.',
        'key.storedMasked': 'Credencial guardada {name} ({masked}).',
        'key.configured': 'Hay una clave configurada para {name}.',
        'key.missing': 'No hay clave para {name}.',
        'key.unavailable': 'No se pudo leer el estado de la clave.',
        'key.placeholder': 'Pega la clave',
        'key.save': 'Guardar clave',
        'key.saving': 'Guardando...',
        'key.remove': 'Quitar clave',
        'key.removing': 'Quitando...',
        'key.empty': 'Escribe una clave antes de guardar.',
        'key.readOnly': 'El almacén de credenciales es de solo lectura en este perfil.',
        'key.privacy':
          'La clave la escribe el Host en el almacén de credenciales; nunca entra a esta sesión ni a la configuración.',
        'status.heading': 'Estado',
        'status.loading': 'Leyendo el estado del Host...',
        'status.idle': 'Actualiza para leer la configuración del Host.',
        'status.failed': 'El Host no respondió al comando de estado.',
        'status.refresh': 'Actualizar',
        'error.template': 'Jev no pudo {action}: {reason}',
        'error.action.save': 'guardar la clave',
        'error.action.remove': 'quitar la clave',
      },
    };

    const STYLE_TEXT = `
.sdjev-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsw-font-xxs-12);line-height:1;cursor:pointer}
.sdjev-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.sdjev-chip:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:1px}
.sdjev-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.45}
.sdjev-dot[data-state=${DOT_STATE.configured}]{background:var(--dsw-alias-state-business-primary);opacity:1}
.sdjev-dot[data-state=${DOT_STATE.failed}]{background:var(--dsw-alias-state-error-primary);opacity:1}
.sdjev-root{position:fixed;inset:0;z-index:${DIALOG_Z_INDEX};display:flex;align-items:center;justify-content:center;padding:24px}
.sdjev-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.sdjev-dialog{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;width:min(460px,100%);max-height:calc(100dvh - 48px);overflow:auto;padding:20px;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);font-size:var(--dsw-font-xxs-12);line-height:18px}
.sdjev-dialog:focus{outline:none}
.sdjev-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sdjev-title{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.sdjev-close{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font-size:18px;line-height:1;cursor:pointer}
.sdjev-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.sdjev-section{display:flex;flex-direction:column;gap:8px}
.sdjev-section-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sdjev-heading{margin:0;font-size:var(--dsw-font-xs-13);font-weight:500;color:var(--dsw-alias-label-primary)}
.sdjev-note{margin:0;color:var(--dsw-alias-label-tertiary)}
.sdjev-row{display:flex;gap:8px}
.sdjev-input{flex:1;min-width:0;box-sizing:border-box;height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);font:inherit;font-size:var(--dsw-font-xxs-12)}
.sdjev-input:focus{outline:none;border-color:var(--dsw-focus-ring-color);box-shadow:0 0 0 1px var(--dsw-focus-ring-color)}
.sdjev-input:disabled{opacity:.6}
.sdjev-button{flex:none;height:32px;padding:0 12px;border:0;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-on-color);font:inherit;font-size:var(--dsw-font-xxs-12);font-weight:500;cursor:pointer}
.sdjev-button:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}
.sdjev-button:disabled{opacity:.55;cursor:default}
.sdjev-button-quiet{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-weight:400}
.sdjev-button-quiet:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sdjev-status{margin:0;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:var(--dsw-font-xxs-12);line-height:18px;white-space:pre-wrap;overflow-wrap:anywhere}
.sdjev-error{margin:0;color:var(--dsw-alias-state-error-primary)}
@media (max-width:480px){.sdjev-root{padding:12px}.sdjev-row{flex-wrap:wrap}.sdjev-button{flex:1 1 auto}}
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

    function statusTextOf(t, status) {
      if (status.error !== undefined) {
        return `${t('status.failed')} ${status.error}`;
      }
      return t('status.failed');
    }

    function statusBody(t, state) {
      if (state.status.phase === STORE_PHASE.failed) {
        return h('p', { className: 'sdjev-error' }, statusTextOf(t, state.status));
      }
      if (state.status.text !== undefined) {
        return h('pre', { className: 'sdjev-status' }, state.status.text);
      }
      return h(
        'p',
        { className: 'sdjev-note' },
        state.status.phase === STORE_PHASE.loading
          ? t('status.loading')
          : t('status.idle'),
      );
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
        h('style', null, STYLE_TEXT),
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
      const inputRef = useRef(null);
      const [draft, setDraft] = useState('');
      const [busy, setBusy] = useState(undefined);
      const [failure, setFailure] = useState(undefined);

      useDialogFocus(inputRef);
      useDialogKeys({ dialogRef, onClose });

      useEffect(() => {
        const { phase, sessionId: loadedSessionId } = state.status;
        if (phase !== STORE_PHASE.idle && loadedSessionId === sessionId) {
          return;
        }
        void jev.loadStatus(sessionId);
      }, [jev, sessionId, state.status]);

      const submit = useCallback(async () => {
        if (busy !== undefined) {
          return;
        }
        const value = draft.trim();
        if (value === '') {
          setFailure(t('key.empty'));
          return;
        }
        setBusy(BUSY_SAVE);
        setFailure(undefined);
        const message = await jev.saveKey(value);
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
        void jev.loadStatus(sessionId);
      }, [busy, draft, jev, sessionId, t]);

      const remove = useCallback(async () => {
        if (busy !== undefined) {
          return;
        }
        setBusy(BUSY_REMOVE);
        setFailure(undefined);
        const message = await jev.removeKey();
        setBusy(undefined);
        if (message !== undefined) {
          setFailure(
            t('error.template', {
              action: t('error.action.remove'),
              reason: message,
            }),
          );
          return;
        }
        void jev.loadStatus(sessionId);
      }, [busy, jev, sessionId, t]);

      const refresh = useCallback(() => {
        void jev.loadStatus(sessionId);
      }, [jev, sessionId]);

      const readOnly = state.key?.writable === false;
      const saving = busy !== undefined;
      const onInputKeyDown = useCallback(
        (event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void submit();
        },
        [submit],
      );

      return createPortal(
        h(
          'div',
          { className: 'sdjev-root' },
          h('div', { 'className': 'sdjev-mask', 'onClick': onClose, 'aria-hidden': 'true' }),
          h(
            'div',
            {
              'ref': dialogRef,
              'className': 'sdjev-dialog',
              'role': 'dialog',
              'aria-modal': 'true',
              'aria-label': t('dialog.title'),
              'tabIndex': -1,
            },
            h(
              'div',
              { className: 'sdjev-header' },
              h('h2', { className: 'sdjev-title' }, t('dialog.title')),
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
              'section',
              { className: 'sdjev-section' },
              h('h3', { className: 'sdjev-heading' }, t('key.heading')),
              h('p', { className: 'sdjev-note' }, keySourceText(t, state)),
              h(
                'div',
                { className: 'sdjev-row' },
                h('input', {
                  'ref': inputRef,
                  'className': 'sdjev-input',
                  'type': 'password',
                  'autoComplete': 'off',
                  'spellCheck': false,
                  'placeholder': t('key.placeholder'),
                  'aria-label': t('key.placeholder'),
                  'value': draft,
                  'disabled': readOnly,
                  'onChange': (event) => {
                    setDraft(event.target.value);
                  },
                  'onKeyDown': onInputKeyDown,
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sdjev-button',
                    onClick: submit,
                    disabled: saving || readOnly,
                  },
                  busy === BUSY_SAVE ? t('key.saving') : t('key.save'),
                ),
              ),
              h(
                'div',
                { className: 'sdjev-row' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sdjev-button sdjev-button-quiet',
                    onClick: remove,
                    disabled: saving || readOnly || state.key?.configured !== true,
                  },
                  busy === BUSY_REMOVE ? t('key.removing') : t('key.remove'),
                ),
              ),
              readOnly ? h('p', { className: 'sdjev-note' }, t('key.readOnly')) : null,
              h('p', { className: 'sdjev-note' }, t('key.privacy')),
            ),
            failure === undefined
              ? null
              : h('p', { className: 'sdjev-error', role: 'alert' }, failure),
            h(
              'section',
              { className: 'sdjev-section' },
              h(
                'div',
                { className: 'sdjev-section-header' },
                h('h3', { className: 'sdjev-heading' }, t('status.heading')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sdjev-button sdjev-button-quiet',
                    onClick: refresh,
                    disabled: state.status.phase === STORE_PHASE.loading,
                  },
                  t('status.refresh'),
                ),
              ),
              statusBody(t, state),
            ),
          ),
        ),
        document.body,
      );
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

    function useDialogFocus(inputRef) {
      useEffect(() => {
        const previous = document.activeElement;
        if (inputRef.current !== null) {
          inputRef.current.focus();
        }
        return () => {
          if (previous instanceof HTMLElement) {
            previous.focus();
          }
        };
      }, [inputRef]);
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
