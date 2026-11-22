window.__ModuleLoader__.load({
  id: "@rmrdeveloper/sideroom-dsh",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/main.ts
var main_exports = {};
__export(main_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(main_exports);

// src/client/components/jev-chip.tsx
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react3 = require("react");

// src/client/constants.ts
var SLOT_NAME = "conversation.composer.dock";
var SLOT_ID = "jev";
var SLOT_ORDER = 30;
var LOCALE_NAMESPACE = "sideroom-jev";
var CHIP_LABEL = "Jev";
var DEFAULT_KEY_ENV = "TYPESAFE_API_KEY";
var STATUS_COMMAND = "/jev status";
var CREDENTIAL_UPDATE_EVENT = "credentials/reference-updated";
var CREDENTIAL_SOURCE_ENVIRONMENT = "env";
var CREDENTIAL_SOURCE_STORE = "file";
var STYLE_ATTRIBUTE = "data-sideroom-jev";
var KEY_ENV_LINE = /^keyEnv:[ \t]*(.+?)[ \t]*$/mu;
var STORE_PHASE = {
  idle: "idle",
  loading: "loading",
  ready: "ready",
  failed: "failed"
};

// src/client/model/key-view.ts
function chipTitle(t, snapshot) {
  if (snapshot.phase !== STORE_PHASE.ready) {
    return t("chip.title.unavailable");
  }
  return snapshot.key?.configured === true ? t("chip.title.withKey") : t("chip.title.withoutKey");
}
function keyTone(snapshot) {
  if (snapshot.phase === STORE_PHASE.failed) {
    return "failed";
  }
  if (snapshot.phase === STORE_PHASE.loading) {
    return "loading";
  }
  return snapshot.key?.configured === true ? "ok" : "missing";
}
function keyLabel(t, snapshot) {
  if (snapshot.phase === STORE_PHASE.failed) {
    return t("key.source.unavailable");
  }
  if (snapshot.key === void 0) {
    return snapshot.phase === STORE_PHASE.loading ? t("key.source.loading") : t("key.source.missing");
  }
  if (snapshot.key.configured !== true) {
    return t("key.source.missing");
  }
  if (snapshot.key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
    return t("key.source.environment");
  }
  return t("key.source.stored");
}
function keySourceText(t, snapshot) {
  if (snapshot.phase === STORE_PHASE.failed) {
    return t("key.unavailable");
  }
  const key = snapshot.key;
  if (key === void 0) {
    return snapshot.phase === STORE_PHASE.loading ? t("key.loading") : t("key.missing", { name: snapshot.keyEnv });
  }
  if (key.configured !== true) {
    return t("key.missing", { name: snapshot.keyEnv });
  }
  if (key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
    return t("key.fromEnvironment", { name: snapshot.keyEnv });
  }
  if (key.source === CREDENTIAL_SOURCE_STORE) {
    return t("key.stored", { name: snapshot.keyEnv });
  }
  return t("key.configured", { name: snapshot.keyEnv });
}
function keyMaskedText(snapshot) {
  if (snapshot.key?.configured !== true) {
    return void 0;
  }
  return snapshot.key.masked;
}
function keyLockedByEnvironment(snapshot) {
  return snapshot.key?.source === CREDENTIAL_SOURCE_ENVIRONMENT;
}
function keyEditable(snapshot) {
  if (snapshot.phase !== STORE_PHASE.ready) {
    return false;
  }
  if (snapshot.key?.writable === false) {
    return false;
  }
  return !keyLockedByEnvironment(snapshot);
}

// src/client/components/dot-state.ts
var PILL_TONE_STATE = {
  business: "ongoing",
  error: "error",
  neutral: "idle",
  success: "done"
};
var KEY_TONE_STATE = {
  ok: "done",
  missing: "warning",
  failed: "error",
  loading: "ongoing"
};

// src/client/components/jev-dialog.tsx
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react2 = require("react");

// src/client/run.ts
function runInBackground(promise) {
  promise.catch((error) => {
    console.error("sideroom-dsh: a Jev request failed", error);
  });
}

// src/client/components/credential-section.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");

// src/client/components/key-input.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function KeyInput({
  t,
  value,
  revealed,
  onChange,
  onToggleReveal
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sideroom-jev__field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Input,
      {
        className: "sideroom-jev__input",
        type: revealed ? "text" : "password",
        value,
        placeholder: t("key.placeholder"),
        "aria-label": t("key.heading"),
        autoComplete: "off",
        spellCheck: false,
        onChange
      }
    ),
    value.trim() === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "ghost", onClick: onToggleReveal, children: revealed ? t("key.hide") : t("key.show") })
  ] });
}

// src/client/components/remove-confirmation.tsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime2 = require("react/jsx-runtime");
function RemoveConfirmation({
  t,
  saving,
  removing,
  onConfirm,
  onCancel
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sideroom-jev__confirm", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "sideroom-jev__note", children: t("key.removeConfirm") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sideroom-jev__actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "primary", disabled: saving, onClick: onConfirm, children: removing ? t("key.removing") : t("key.removeConfirmAction") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "ghost", disabled: saving, onClick: onCancel, children: t("key.cancel") })
    ] })
  ] });
}

// src/client/components/credential-section.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var BUSY = { save: "save", remove: "remove" };
function CredentialSection({
  t,
  snapshot,
  jev,
  onSaved
}) {
  const [draft, setDraft] = (0, import_react.useState)("");
  const [revealed, setRevealed] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(void 0);
  const [failure, setFailure] = (0, import_react.useState)(void 0);
  const [notice, setNotice] = (0, import_react.useState)(void 0);
  const [confirmingRemove, setConfirmingRemove] = (0, import_react.useState)(false);
  const editable = keyEditable(snapshot);
  const locked = keyLockedByEnvironment(snapshot);
  const readOnly = snapshot.key?.writable === false;
  const saving = busy !== void 0;
  const hasDraft = draft.trim() !== "";
  const save = (0, import_react.useCallback)(() => {
    if (saving || !editable || !hasDraft) {
      return;
    }
    setBusy(BUSY.save);
    setFailure(void 0);
    setNotice(void 0);
    jev.saveKey(draft.trim()).then((message) => {
      setBusy(void 0);
      if (message === void 0) {
        setDraft("");
        setRevealed(false);
        setNotice(t("key.saved"));
        onSaved();
        return;
      }
      setFailure(t("error.template", {
        action: t("error.action.save"),
        reason: message
      }));
    }).catch((error) => {
      setBusy(void 0);
      setFailure(errorMessageOf(error));
    });
  }, [draft, editable, hasDraft, jev, onSaved, saving, t]);
  const remove = (0, import_react.useCallback)(() => {
    if (saving) {
      return;
    }
    setBusy(BUSY.remove);
    setFailure(void 0);
    setNotice(void 0);
    jev.removeKey().then((message) => {
      setBusy(void 0);
      setConfirmingRemove(false);
      if (message === void 0) {
        setNotice(t("key.removed"));
        onSaved();
        return;
      }
      setFailure(t("error.template", {
        action: t("error.action.remove"),
        reason: message
      }));
    }).catch((error) => {
      setBusy(void 0);
      setConfirmingRemove(false);
      setFailure(errorMessageOf(error));
    });
  }, [jev, onSaved, saving, t]);
  const changeDraft = (0, import_react.useCallback)((event) => {
    setDraft(event.target.value);
    setFailure(void 0);
    setNotice(void 0);
  }, []);
  const toggleReveal = (0, import_react.useCallback)(() => {
    setRevealed((current) => !current);
  }, []);
  const cancelRemove = (0, import_react.useCallback)(() => {
    setConfirmingRemove(false);
  }, []);
  const requestRemove = (0, import_react.useCallback)(() => {
    setConfirmingRemove(true);
  }, []);
  const pill = keyLabel(t, snapshot);
  const masked = keyMaskedText(snapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "sideroom-jev__section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "sideroom-jev__section-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "sideroom-jev__heading", children: t("key.heading") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "sideroom-jev__badge", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: KEY_TONE_STATE[keyTone(snapshot)] }),
        pill
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: snapshot.phase === "failed" ? "sideroom-jev__error" : "sideroom-jev__source", children: keySourceText(t, snapshot) }),
    masked === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "sideroom-jev__masked", children: masked }),
    editable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      KeyInput,
      {
        t,
        value: draft,
        revealed,
        onChange: changeDraft,
        onToggleReveal: toggleReveal
      }
    ) : null,
    editable && confirmingRemove ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      RemoveConfirmation,
      {
        t,
        saving,
        removing: busy === BUSY.remove,
        onConfirm: remove,
        onCancel: cancelRemove
      }
    ) : null,
    editable && !confirmingRemove ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sideroom-jev__actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", disabled: saving || !hasDraft, onClick: save, children: busy === BUSY.save ? t("key.saving") : t("key.save") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_dsh_client_ui_primitives3.Button,
        {
          size: "sm",
          variant: "outline",
          disabled: saving || snapshot.key?.configured !== true,
          onClick: requestRemove,
          children: t("key.remove")
        }
      )
    ] }) : null,
    failure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "sideroom-jev__error", role: "alert", children: failure }),
    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "sideroom-jev__notice", role: "status", children: notice }),
    !locked && readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "sideroom-jev__note", children: t("key.readOnly") }) : null,
    locked ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "sideroom-jev__note", children: t("key.environmentLocked", { name: snapshot.keyEnv }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "sideroom-jev__note", children: t("key.privacy") })
  ] });
}
function errorMessageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/client/components/status-section.tsx
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model/report.ts
var PILL_TONE = {
  business: "business",
  error: "error",
  neutral: "neutral",
  success: "success"
};
var REPORT_FIELD_ORDER = [
  "enabled",
  "keyEnv",
  "key",
  "model",
  "status",
  "calls",
  "cutoff",
  "gate",
  "muted"
];
var REPORT_STATUS_FIELD = "status";
var REPORT_HINT_FIELD = "hint";
var NO_MUTED_RULES = "none";
var REPORT_FIELD_LINE = /^([a-z][a-zA-Z0-9]*):[ \t]*(.*)$/u;
var MONO_FIELDS = /* @__PURE__ */ new Set(["keyEnv", "model"]);
var REPORT_ENABLED_TRUE = "true";
var REPORT_STATUS_VALUES = {
  ready: "ready",
  noKey: "noKey",
  off: "off",
  quota: "quota",
  auth: "auth",
  rateLimited: "rateLimited",
  unavailable: "unavailable"
};
var REPORT_LABELS = {
  enabled: "status.fields.enabled",
  keyEnv: "status.fields.keyEnv",
  key: "status.fields.key",
  model: "status.fields.model",
  status: "status.fields.status",
  calls: "status.fields.calls",
  cutoff: "status.fields.cutoff",
  gate: "status.fields.gate",
  muted: "status.fields.muted"
};
var REPORT_KEY_SOURCE_LABELS = {
  environment: "key.source.environment",
  credentials: "key.source.stored",
  missing: "key.source.missing"
};
var REPORT_STATUS_LABELS = {
  [REPORT_STATUS_VALUES.ready]: "status.state.ready",
  [REPORT_STATUS_VALUES.noKey]: "status.state.noKey",
  [REPORT_STATUS_VALUES.off]: "status.state.off",
  [REPORT_STATUS_VALUES.quota]: "status.state.quota",
  [REPORT_STATUS_VALUES.auth]: "status.state.auth",
  [REPORT_STATUS_VALUES.rateLimited]: "status.state.rateLimited",
  [REPORT_STATUS_VALUES.unavailable]: "status.state.unavailable"
};
var REPORT_STATUS_TONES = {
  [REPORT_STATUS_VALUES.ready]: PILL_TONE.success,
  [REPORT_STATUS_VALUES.noKey]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.auth]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.quota]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.unavailable]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.off]: PILL_TONE.neutral,
  [REPORT_STATUS_VALUES.rateLimited]: PILL_TONE.neutral
};
function parseReport(text) {
  const fields = [];
  let hint;
  for (const rawLine of text.split("\n")) {
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
    return void 0;
  }
  return { fields, hint };
}
function reportRowsOf(t, fields) {
  return orderedReportFields(fields).map((field) => ({
    name: field.name,
    label: translateKnown({ t, labels: REPORT_LABELS, value: field.name }),
    value: reportValueOf(t, field),
    tone: reportToneOf(field),
    mono: MONO_FIELDS.has(field.name),
    marked: field.name === REPORT_STATUS_FIELD
  }));
}
function orderedReportFields(fields) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const known = REPORT_FIELD_ORDER.filter((name) => byName.has(name)).map((name) => byName.get(name)).filter((field) => field !== void 0);
  const unknown = fields.filter(
    (field) => !REPORT_FIELD_ORDER.includes(field.name)
  );
  return [...known, ...unknown];
}
function translateKnown({
  t,
  labels,
  value
}) {
  if (!Object.hasOwn(labels, value)) {
    return value;
  }
  return t(labels[value]);
}
function reportValueOf(t, field) {
  if (field.name === "enabled") {
    return field.value === REPORT_ENABLED_TRUE ? t("status.enabled.true") : t("status.enabled.false");
  }
  if (field.name === "key") {
    return translateKnown({ t, labels: REPORT_KEY_SOURCE_LABELS, value: field.value });
  }
  if (field.name === REPORT_STATUS_FIELD) {
    return translateKnown({ t, labels: REPORT_STATUS_LABELS, value: field.value });
  }
  if (field.name === "muted" && field.value === NO_MUTED_RULES) {
    return t("status.mutedNone");
  }
  return field.value;
}
function reportToneOf(field) {
  if (field.name !== REPORT_STATUS_FIELD) {
    return PILL_TONE.neutral;
  }
  return REPORT_STATUS_TONES[field.value] ?? PILL_TONE.neutral;
}

// src/client/model/status-view.ts
function statusViewOf({
  t,
  status,
  sessionId
}) {
  if (status.phase === STORE_PHASE.failed) {
    return failedView({ t, status });
  }
  if (status.text !== void 0) {
    const parsed = parseReport(status.text);
    if (parsed === void 0) {
      return { kind: "raw", text: status.text };
    }
    return {
      kind: "report",
      rows: reportRowsOf(t, parsed.fields),
      hint: parsed.hint
    };
  }
  if (status.phase === STORE_PHASE.loading) {
    return { kind: "text", text: t("status.loading") };
  }
  return {
    kind: "text",
    text: sessionId === void 0 ? t("status.noSession") : t("status.idle")
  };
}
function failedView({
  t,
  status
}) {
  if (status.error === void 0 && status.sessionId === void 0) {
    return { kind: "text", text: t("status.noSession") };
  }
  return { kind: "error", text: t("status.failed"), detail: status.error };
}

// src/client/components/status-rows.tsx
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime4 = require("react/jsx-runtime");
function StatusRows({
  rows
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dl", { className: "sideroom-jev__rows", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sideroom-jev__row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { className: "sideroom-jev__term", children: row.label }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "dd",
      {
        className: row.mono ? "sideroom-jev__value sideroom-jev__mono" : "sideroom-jev__value",
        children: [
          row.marked ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.StateDot, { state: PILL_TONE_STATE[row.tone] }) : null,
          row.value
        ]
      }
    )
  ] }, row.name)) });
}

// src/client/components/status-section.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function StatusSection({
  t,
  sessionId,
  status,
  onRefresh
}) {
  const view = statusViewOf({ t, status, sessionId });
  const refreshing = status.phase === STORE_PHASE.loading;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "sideroom-jev__section", "aria-busy": refreshing, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "sideroom-jev__section-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "sideroom-jev__heading", children: t("status.heading") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_dsh_client_ui_primitives5.Button,
        {
          size: "sm",
          variant: "outline",
          onClick: onRefresh,
          disabled: refreshing || sessionId === void 0,
          children: refreshing ? t("status.refreshing") : t("status.refresh")
        }
      )
    ] }),
    statusBodyOf(view)
  ] });
}
function statusBodyOf(view) {
  if (view.kind === "report") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sideroom-jev__report", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(StatusRows, { rows: view.rows }),
      view.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "sideroom-jev__hint", children: view.hint })
    ] });
  }
  if (view.kind === "raw") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "sideroom-jev__raw", children: view.text });
  }
  if (view.kind === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "sideroom-jev__error", children: view.detail === void 0 ? view.text : `${view.text} ${view.detail}` });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "sideroom-jev__note", children: view.text });
}

// src/client/components/jev-dialog.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function JevDialog({
  open,
  onClose,
  t,
  sessionId,
  snapshot,
  jev
}) {
  const refresh = (0, import_react2.useCallback)(() => {
    runInBackground(jev.loadStatus(sessionId));
  }, [jev, sessionId]);
  (0, import_react2.useEffect)(() => {
    if (!open || sessionId === void 0) {
      return;
    }
    const { phase, sessionId: loadedSessionId } = snapshot.status;
    if (phase !== STORE_PHASE.idle && loadedSessionId === sessionId) {
      return;
    }
    runInBackground(jev.loadStatus(sessionId));
  }, [jev, open, sessionId, snapshot.status]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_dsh_client_ui_primitives6.Modal,
    {
      open,
      onClose,
      title: t("dialog.title"),
      description: t("dialog.description"),
      closeLabel: t("dialog.close"),
      className: "sideroom-jev__dialog",
      footer: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives6.Button, { variant: "outline", onClick: onClose, children: t("dialog.close") }),
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sideroom-jev__sections", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CredentialSection, { t, snapshot, jev, onSaved: refresh }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          StatusSection,
          {
            t,
            sessionId,
            status: snapshot.status,
            onRefresh: refresh
          }
        )
      ] })
    }
  );
}

// src/client/components/jev-chip.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function JevChip({
  t,
  sessionId,
  useJevState,
  jev
}) {
  const snapshot = useJevState((current) => current);
  const [open, setOpen] = (0, import_react3.useState)(false);
  const openDialog = (0, import_react3.useCallback)(() => {
    setOpen(true);
  }, []);
  const closeDialog = (0, import_react3.useCallback)(() => {
    setOpen(false);
  }, []);
  const title = chipTitle(t, snapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      import_dsh_client_ui_primitives7.Pill,
      {
        className: "sideroom-jev__chip",
        active: open,
        title,
        "aria-label": title,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: openDialog,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.StateDot, { state: KEY_TONE_STATE[keyTone(snapshot)] }),
          CHIP_LABEL
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      JevDialog,
      {
        open,
        onClose: closeDialog,
        t,
        sessionId,
        snapshot,
        jev
      }
    )
  ] });
}

// src/client/locale/en.ts
var en = {
  "chip.title.withKey": "Jev: key configured",
  "chip.title.withoutKey": "Jev: no key",
  "chip.title.unavailable": "Jev: key state unavailable",
  "dialog.title": "Jev settings",
  "dialog.description": "API key and Host status.",
  "dialog.close": "Close",
  "key.heading": "Key",
  "key.loading": "Reading the key state...",
  "key.fromEnvironment": "Read from the environment variable {name}.",
  "key.stored": "Stored credential {name}.",
  "key.configured": "A key is configured for {name}.",
  "key.missing": "No key for {name}.",
  "key.unavailable": "The key state could not be read.",
  "key.unavailableDetail": "The key state could not be read: {reason}",
  "key.source.loading": "Reading",
  "key.source.stored": "Stored",
  "key.source.environment": "Environment",
  "key.source.missing": "Missing",
  "key.source.unavailable": "Unavailable",
  "key.placeholder": "Paste the API key",
  "key.save": "Save key",
  "key.saving": "Saving...",
  "key.remove": "Remove",
  "key.removing": "Removing...",
  "key.show": "Show",
  "key.hide": "Hide",
  "key.readOnly": "The credential store is read-only in this profile.",
  "key.environmentLocked": "The key comes from {name}. The environment variable wins, so the stored credential is ignored while it is set.",
  "key.privacy": "The Host writes the key to the credential store; it never enters this session or the configuration.",
  "key.saved": "Key saved.",
  "key.removed": "Key removed.",
  "key.removeConfirm": "Remove the stored key from this profile?",
  "key.removeConfirmAction": "Remove key",
  "key.cancel": "Cancel",
  "status.heading": "Status",
  "status.loading": "Reading the Host status...",
  "status.idle": "Refresh to read the Host configuration.",
  "status.noSession": "The status comes from the conversation. Send a message, then refresh.",
  "status.failed": "The Host did not answer the status command.",
  "status.refresh": "Refresh",
  "status.refreshing": "Refreshing...",
  "status.mutedNone": "None",
  "status.fields.enabled": "Enabled",
  "status.fields.keyEnv": "Reference",
  "status.fields.key": "Source",
  "status.fields.model": "Model",
  "status.fields.status": "State",
  "status.fields.calls": "Calls",
  "status.fields.cutoff": "Note cutoff",
  "status.fields.gate": "Global gate",
  "status.fields.muted": "Muted",
  "status.enabled.true": "Yes",
  "status.enabled.false": "No",
  "status.state.ready": "Ready",
  "status.state.noKey": "No key",
  "status.state.off": "Off",
  "status.state.quota": "Quota exhausted",
  "status.state.auth": "Key rejected",
  "status.state.rateLimited": "Rate limited",
  "status.state.unavailable": "Unavailable",
  "error.template": "Jev could not {action}: {reason}",
  "error.action.save": "save the key",
  "error.action.remove": "remove the key"
};

// src/client/locale/es.ts
var es = {
  "chip.title.withKey": "Jev: clave configurada",
  "chip.title.withoutKey": "Jev: sin clave",
  "chip.title.unavailable": "Jev: estado de la clave no disponible",
  "dialog.title": "Configuraci\xF3n de Jev",
  "dialog.description": "Clave de API y estado del Host.",
  "dialog.close": "Cerrar",
  "key.heading": "Clave",
  "key.loading": "Leyendo el estado de la clave...",
  "key.fromEnvironment": "Se lee de la variable de entorno {name}.",
  "key.stored": "Credencial guardada {name}.",
  "key.configured": "Hay una clave configurada para {name}.",
  "key.missing": "No hay clave para {name}.",
  "key.unavailable": "No se pudo leer el estado de la clave.",
  "key.unavailableDetail": "No se pudo leer el estado de la clave: {reason}",
  "key.source.loading": "Leyendo",
  "key.source.stored": "Guardada",
  "key.source.environment": "Entorno",
  "key.source.missing": "Sin clave",
  "key.source.unavailable": "No disponible",
  "key.placeholder": "Pega la clave de API",
  "key.save": "Guardar clave",
  "key.saving": "Guardando...",
  "key.remove": "Quitar",
  "key.removing": "Quitando...",
  "key.show": "Mostrar",
  "key.hide": "Ocultar",
  "key.readOnly": "El almac\xE9n de credenciales es de solo lectura en este perfil.",
  "key.environmentLocked": "La clave viene de {name}. La variable de entorno tiene prioridad, as\xED que la credencial guardada se ignora mientras est\xE9 definida.",
  "key.privacy": "La clave la escribe el Host en el almac\xE9n de credenciales; nunca entra a esta sesi\xF3n ni a la configuraci\xF3n.",
  "key.saved": "Clave guardada.",
  "key.removed": "Clave quitada.",
  "key.removeConfirm": "\xBFQuitar la clave guardada de este perfil?",
  "key.removeConfirmAction": "Quitar clave",
  "key.cancel": "Cancelar",
  "status.heading": "Estado",
  "status.loading": "Leyendo el estado del Host...",
  "status.idle": "Actualiza para leer la configuraci\xF3n del Host.",
  "status.noSession": "El estado se lee de la conversaci\xF3n actual. Env\xEDa un mensaje y actualiza.",
  "status.failed": "El Host no respondi\xF3 al comando de estado.",
  "status.refresh": "Actualizar",
  "status.refreshing": "Actualizando...",
  "status.mutedNone": "Ninguna",
  "status.fields.enabled": "Activo",
  "status.fields.keyEnv": "Referencia",
  "status.fields.key": "Origen",
  "status.fields.model": "Modelo",
  "status.fields.status": "Estado",
  "status.fields.calls": "Llamadas",
  "status.fields.cutoff": "Umbral de nota",
  "status.fields.gate": "Umbral global",
  "status.fields.muted": "Silenciadas",
  "status.enabled.true": "S\xED",
  "status.enabled.false": "No",
  "status.state.ready": "Listo",
  "status.state.noKey": "Sin clave",
  "status.state.off": "Desactivado",
  "status.state.quota": "Cuota agotada",
  "status.state.auth": "Clave rechazada",
  "status.state.rateLimited": "L\xEDmite alcanzado",
  "status.state.unavailable": "No disponible",
  "error.template": "Jev no pudo {action}: {reason}",
  "error.action.save": "guardar la clave",
  "error.action.remove": "quitar la clave"
};

// src/client/locale/index.ts
var DICTIONARIES = { en, es };

// src/client/store.ts
var EMPTY_STATUS = Object.freeze({ phase: STORE_PHASE.idle });
function createJevStore({
  credentials,
  commands
}) {
  let snapshot = {
    phase: STORE_PHASE.loading,
    keyEnv: DEFAULT_KEY_ENV,
    status: EMPTY_STATUS
  };
  const listeners = /* @__PURE__ */ new Set();
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
      error: void 0,
      key: response.value[snapshot.keyEnv]
    });
  }
  async function refresh() {
    try {
      await readKey();
    } catch (error) {
      publish({ phase: STORE_PHASE.failed, error: messageOf(error) });
    }
  }
  async function runWrite(operation) {
    try {
      const response = await operation();
      if (!response.ok) {
        return response.error.message;
      }
      await refresh();
      return void 0;
    } catch (error) {
      return messageOf(error);
    }
  }
  function saveKey(value) {
    return runWrite(() => credentials.set(snapshot.keyEnv, value));
  }
  function removeKey() {
    return runWrite(() => credentials.unset(snapshot.keyEnv));
  }
  async function loadStatus(sessionId) {
    if (sessionId === void 0) {
      publish({ status: statusFailure({ sessionId, error: void 0 }) });
      return;
    }
    publish({ status: statusLoading({ sessionId, text: snapshot.status.text }) });
    try {
      const response = await commands.execute(sessionId, STATUS_COMMAND);
      if (!response.ok) {
        publish({
          status: statusFailure({ sessionId, error: response.error.message })
        });
        return;
      }
      const answer = statusAnswerOf(response.value);
      if (answer?.kind !== "success" || answer.text === void 0) {
        publish({
          status: statusFailure({ sessionId, error: answer?.text })
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
        status: statusFailure({ sessionId, error: messageOf(error) })
      });
    }
  }
  return { getSnapshot, subscribe, refresh, saveKey, removeKey, loadStatus };
}
function statusLoading({
  sessionId,
  text
}) {
  return { phase: STORE_PHASE.loading, text, sessionId };
}
function statusReady({
  sessionId,
  text
}) {
  return { phase: STORE_PHASE.ready, text, sessionId };
}
function statusFailure({
  sessionId,
  error
}) {
  return { phase: STORE_PHASE.failed, error, sessionId };
}
function statusAnswerOf(execution) {
  return execution?.result;
}
function keyEnvOf(report) {
  const match = KEY_ENV_LINE.exec(report);
  return match === null ? void 0 : match[1];
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/client/styles/jev.css
var jev_default = ".sideroom-jev__chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  height: 24px;\n  padding: 0 10px;\n}\n\n.sideroom-jev__dialog {\n  width: min(560px, calc(100vw - 48px));\n}\n\n.sideroom-jev__sections {\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n}\n\n.sideroom-jev__section {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.sideroom-jev__section-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.sideroom-jev__heading {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.sideroom-jev__badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__source {\n  margin: 0;\n  overflow-wrap: anywhere;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__note {\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__error {\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.sideroom-jev__notice {\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.sideroom-jev__actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.sideroom-jev__confirm {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 12px;\n  border-radius: var(--dsw-radius-lg);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.sideroom-jev__rows {\n  display: grid;\n  grid-template-columns: minmax(96px, max-content) 1fr;\n  gap: 8px 20px;\n  margin: 0;\n}\n\n.sideroom-jev__row {\n  display: contents;\n}\n\n.sideroom-jev__term {\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__value {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  margin: 0;\n  overflow-wrap: anywhere;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.sideroom-jev__mono {\n  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);\n}\n\n.sideroom-jev__raw {\n  margin: 0;\n  padding: 12px;\n  overflow-x: auto;\n  border-radius: var(--dsw-radius-lg);\n  background: var(--dsw-alias-bg-layer-3);\n  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);\n  font-size: 12px;\n  line-height: 18px;\n  white-space: pre-wrap;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__hint {\n  margin: 0;\n  padding: 10px 12px;\n  border-radius: var(--dsw-radius-lg);\n  background: var(--dsw-alias-bg-layer-3);\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.sideroom-jev__field {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.sideroom-jev__input {\n  flex: 1 1 auto;\n}\n\n.sideroom-jev__report {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.sideroom-jev__masked {\n  display: block;\n  overflow-wrap: anywhere;\n  word-break: break-all;\n  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n";

// src/client/styles/install.ts
function installStyles() {
  const head = document.head;
  const existing = head.querySelector(`style[${STYLE_ATTRIBUTE}]`);
  if (existing !== null) {
    return () => void 0;
  }
  const element = document.createElement("style");
  element.setAttribute(STYLE_ATTRIBUTE, "");
  element.textContent = jev_default;
  head.appendChild(element);
  return () => {
    element.remove();
  };
}

// src/client/plugin.ts
var inject = [
  "slots",
  "locale",
  "remote",
  "remote.credentials",
  "remote.commands"
];
function apply(ctx) {
  const credentials = {
    describe: (refs) => ctx.remote.credentials.describe(refs),
    set: (ref, value) => ctx.remote.credentials.set(ref, value),
    unset: (ref) => ctx.remote.credentials.unset(ref)
  };
  const commands = {
    execute: (sessionId, line) => ctx.remote.commands.execute(sessionId, line)
  };
  const store = createJevStore({ credentials, commands });
  ctx.effect(() => installStyles());
  for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
    ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, locale, dictionary));
  }
  ctx.effect(() => ctx.remote.$on(CREDENTIAL_UPDATE_EVENT, (ref) => {
    if (ref === store.getSnapshot().keyEnv) {
      runInBackground(store.refresh());
    }
  }));
  ctx.effect(() => {
    runInBackground(store.refresh());
    return () => void 0;
  });
  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register(
    {
      name: SLOT_NAME,
      id: SLOT_ID,
      order: SLOT_ORDER,
      locale: LOCALE_NAMESPACE,
      inject: () => ({ hooks: { jevState: store }, jev: store })
    },
    JevChip
  ));
}
    return module.exports;
  },
});
