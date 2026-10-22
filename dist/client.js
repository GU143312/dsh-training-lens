window.__ModuleLoader__.load({ id: "dsh-training-lens", factory(require) { const module = {exports: {}}; const exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  LensPanel: () => LensPanel,
  apply: () => apply,
  dashboardUrl: () => dashboardUrl,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);

// src/wire.js
var stringCodec = (name, limit) => ({
  mode: "strict",
  typeSymbol: `dsh-training-lens#${name}`,
  create: () => ({
    parse(value) {
      if (typeof value !== "string" || value.length > limit)
        throw new Error("Invalid Training Lens request.");
      return value;
    }
  })
});
var TYPERT_REMOTE = {
  package: "dsh-training-lens",
  descriptors: [
    {
      id: "dsh-training-lens#trainingLens/control",
      service: "trainingLens",
      namespace: "trainingLens",
      method: "control",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          wire: "request",
          source: "json",
          codec: stringCodec("request", 2e4)
        }
      ],
      result: stringCodec("result", 4e4)
    }
  ]
};
var TYPERT = {
  package: "dsh-training-lens",
  face: "host",
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: TYPERT_REMOTE.descriptors
};

// src/client.js
var h = import_react.default.createElement;
var copy = {
  title: ["\u8BAD\u7EC3\u89C6\u7A97", "Training Lens"],
  close: ["\u5173\u95ED\u9762\u677F", "Close panel"],
  connection: ["\u8FDE\u63A5\u4E0E\u542F\u52A8\u8BBE\u7F6E", "Connection and startup settings"],
  intro: [
    "\u9009\u597D\u65E5\u5FD7\u76EE\u5F55\u540E\uFF0C\u4E00\u952E\u542F\u52A8\u548C\u67E5\u770B\uFF0C\u4E0D\u7528\u8BB0\u7AEF\u53E3\u3002",
    "Choose your log directory, then start and view without remembering a port."
  ],
  logdir: [
    "TensorBoard \u65E5\u5FD7\u76EE\u5F55\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09",
    "TensorBoard log directory (absolute path)"
  ],
  python: ["\u8BAD\u7EC3\u73AF\u5883 Python", "Training environment Python"],
  mode: ["\u81EA\u52A8\u542F\u52A8", "Automatic startup"],
  manual: ["\u624B\u52A8\u542F\u52A8", "Manual"],
  startup: ["\u968F DSH \u542F\u52A8", "When DSH starts"],
  activity: ["\u68C0\u6D4B\u5230\u65E5\u5FD7\u5199\u5165\u65F6\u542F\u52A8", "When TensorBoard logs change"],
  activityHint: [
    "\u6BCF 5 \u79D2\u68C0\u67E5\u6307\u5B9A\u76EE\u5F55\u3002\u68C0\u6D4B\u7684\u662F\u65E5\u5FD7\u5199\u5165\uFF0C\u4E0D\u4EE3\u8868\u8BAD\u7EC3\u8FDB\u7A0B\u5065\u5EB7\u3002\u76EE\u5F55\u53EF\u4EE5\u7A0D\u540E\u7531\u8BAD\u7EC3\u5668\u521B\u5EFA\u3002",
    "Checks the selected directory every 5 seconds. Log writes do not certify trainer health. Your trainer may create the directory later."
  ],
  save: ["\u4FDD\u5B58\u8BBE\u7F6E", "Save settings"],
  saved: ["\u8BBE\u7F6E\u5DF2\u4FDD\u5B58", "Settings saved"],
  start: ["\u542F\u52A8\u5E76\u67E5\u770B", "Start and view"],
  stop: ["\u505C\u6B62\u76D1\u63A7", "Stop dashboard"],
  open: ["\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00", "Open in new tab"],
  loading: ["\u5904\u7406\u4E2D\u2026", "Working\u2026"],
  running: ["\u76D1\u63A7\u8FD0\u884C\u4E2D", "Dashboard running"],
  stopped: ["\u76D1\u63A7\u672A\u542F\u52A8", "Dashboard stopped"],
  watching: ["\u7B49\u5F85\u65E5\u5FD7\u5199\u5165", "Waiting for log writes"],
  unreachable: ["\u76D1\u63A7\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5", "Dashboard is unreachable"],
  pause: [
    "\u672C\u6B21\u4F1A\u8BDD\u7684\u81EA\u52A8\u542F\u52A8\u5DF2\u6682\u505C\uFF1B\u4FDD\u5B58\u8BBE\u7F6E\u53EF\u6062\u590D\u3002",
    "Automatic startup is paused for this session; save settings to resume."
  ],
  persist: [
    "\u5F53\u524D\u5BBF\u4E3B\u6CA1\u6709\u63D0\u4F9B\u4FDD\u5B58\u4F4D\u7F6E\uFF0C\u8BBE\u7F6E\u4EC5\u5728\u672C\u6B21\u4F1A\u8BDD\u751F\u6548\u3002",
    "This host has no settings location; changes last for this session only."
  ],
  training: [
    "\u505C\u6B62\u53EA\u5173\u95ED\u76D1\u63A7\uFF0C\u4E0D\u5F71\u54CD\u8BAD\u7EC3\u3002\u7AEF\u53E3\u7531\u63D2\u4EF6\u81EA\u52A8\u9009\u62E9\u3002",
    "Stopping closes only the dashboard. The plugin chooses an available port."
  ],
  remote: [
    "DSH \u8FD0\u884C\u5728\u8FDC\u7A0B\u4E3B\u673A\uFF1A\u8BF7\u5148\u8F6C\u53D1\u4E0B\u65B9\u5730\u5740\u7684\u7AEF\u53E3\uFF0C\u518D\u5728\u672C\u673A\u6D4F\u89C8\u5668\u6253\u5F00\u3002",
    "DSH is on a remote host: forward the port below before opening it in your browser."
  ],
  error: ["\u64CD\u4F5C\u5931\u8D25", "Operation failed"],
  preview: ["\u8BAD\u7EC3\u76D1\u63A7", "Training dashboard"]
};
var dictionaries = Object.fromEntries(
  ["zh", "en"].map((lang, i) => [
    lang,
    Object.fromEntries(
      Object.entries(copy).map(([key, values]) => [key, values[i]])
    )
  ])
);
var buttonStyle = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #7f8b9b55",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit"
};
var inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid #7f8b9b66",
  background: "transparent",
  color: "inherit",
  font: "inherit"
};
var defaults = { python: "python", logdir: "", port: 0, startMode: "manual" };
function dashboardUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}
function LensPanel({ t, api, close }) {
  const [data, setData] = (0, import_react.useState)(null), [settings, setSettings] = (0, import_react.useState)(defaults);
  const [error, setError] = (0, import_react.useState)(""), [notice, setNotice] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const live = (0, import_react.useRef)(true), busyRef = (0, import_react.useRef)(false), loaded = (0, import_react.useRef)(false), closeButton = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    live.current = true;
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    async function poll() {
      if (busyRef.current) return;
      try {
        const value = await api("status");
        if (!live.current || busyRef.current) return;
        setData(value);
        if (!loaded.current) {
          loaded.current = true;
          setSettings(value.settings);
        }
      } catch (err) {
        if (live.current) setError(err.message);
      }
    }
    void poll();
    const timer = setInterval(poll, 5e3);
    return () => {
      live.current = false;
      clearInterval(timer);
      previousFocus?.focus?.();
    };
  }, [api]);
  async function act(action) {
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let result;
      if (action === "save" || action === "start")
        result = await api("save", settings);
      if (action !== "save") result = await api(action);
      if (live.current) {
        setData(result);
        setSettings(result.settings);
        if (action === "save") setNotice(t("saved"));
      }
    } catch (err) {
      if (live.current) setError(err.message);
    } finally {
      busyRef.current = false;
      if (live.current) setBusy(false);
    }
  }
  const active = data && data.state !== "stopped", url = dashboardUrl(data?.url);
  const local = api.isLocal();
  const label = data?.state === "running" ? "running" : data?.state === "unreachable" ? "unreachable" : data?.watching ? "watching" : "stopped";
  const field = (key, text, control) => h(
    "label",
    { style: { display: "grid", gap: 5 } },
    h("span", null, t(text)),
    control || h("input", {
      "aria-label": t(text),
      value: settings[key],
      disabled: busy || active,
      style: inputStyle,
      onChange: (event) => setSettings((old) => ({ ...old, [key]: event.target.value }))
    })
  );
  return h(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1e3,
        background: "#0007",
        display: "grid",
        placeItems: "center",
        padding: 16
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) close();
      }
    },
    h(
      "section",
      {
        role: "dialog",
        "aria-modal": true,
        "aria-label": t("title"),
        onKeyDown: (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
          if (event.key === "Tab") {
            const controls = [
              ...event.currentTarget.querySelectorAll(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],iframe"
              )
            ];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        },
        style: {
          width: "min(1120px, 100%)",
          maxHeight: "92vh",
          overflow: "auto",
          boxSizing: "border-box",
          borderRadius: 16,
          padding: 22,
          background: "var(--bg-primary, Canvas)",
          color: "var(--text-primary, CanvasText)",
          boxShadow: "0 18px 70px #0006",
          fontSize: 14
        }
      },
      h(
        "header",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12
          }
        },
        h("h2", { style: { margin: 0 } }, t("title")),
        h(
          "button",
          { ref: closeButton, style: buttonStyle, onClick: close },
          t("close")
        )
      ),
      h("p", null, t("intro")),
      h(
        "details",
        { open: !active, style: { margin: "12px 0" } },
        h(
          "summary",
          { style: { cursor: "pointer", marginBottom: 12 } },
          t("connection")
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 12
            }
          },
          field("logdir", "logdir"),
          field("python", "python"),
          field(
            "startMode",
            "mode",
            h(
              "select",
              {
                style: inputStyle,
                value: settings.startMode,
                disabled: busy,
                "aria-label": t("mode"),
                onChange: (event) => setSettings((old) => ({
                  ...old,
                  startMode: event.target.value
                }))
              },
              ...["manual", "startup", "activity"].map(
                (mode) => h("option", { key: mode, value: mode }, t(mode))
              )
            )
          )
        )
      ),
      settings.startMode === "activity" && h("p", null, t("activityHint")),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginTop: 16
          }
        },
        h(
          "button",
          {
            style: buttonStyle,
            disabled: busy || !data,
            onClick: () => act("save")
          },
          t("save")
        ),
        h(
          "button",
          {
            style: { ...buttonStyle, background: "#2c6b58", color: "white" },
            disabled: busy || !data || active,
            onClick: () => act("start")
          },
          t("start")
        ),
        h(
          "button",
          {
            style: buttonStyle,
            disabled: busy || !data || !active && !data?.watching,
            onClick: () => act("stop")
          },
          t("stop")
        ),
        url && local && h(
          "a",
          {
            style: buttonStyle,
            href: url,
            target: "_blank",
            rel: "noopener noreferrer"
          },
          t("open")
        ),
        h("span", { role: "status" }, busy ? t("loading") : t(label))
      ),
      (error || data?.error) && h(
        "p",
        {
          role: "alert",
          style: { color: "#cf493b", overflowWrap: "anywhere" }
        },
        error || data.error
      ),
      notice && h("p", { role: "status" }, notice),
      data?.autoPaused && settings.startMode !== "manual" && h("p", null, t("pause")),
      data && !data.persistent && h("p", null, t("persist")),
      h("p", { style: { opacity: 0.75 } }, t("training")),
      url && !local && h("p", null, t("remote"), " ", h("code", null, url)),
      url && local && data?.state === "running" && h("iframe", {
        key: url,
        src: `${url}/?embedded=1`,
        title: t("preview"),
        style: {
          width: "100%",
          height: "55vh",
          minHeight: 300,
          border: "1px solid #7f8b9b55",
          borderRadius: 10
        }
      })
    )
  );
}
var inject = ["slots", "locale", "remote"];
async function apply(ctx) {
  ctx.effect(() => ctx.locale.register("trainingLens", dictionaries));
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(["remote.trainingLens"], (scope) => {
    let opened = false;
    const listeners = /* @__PURE__ */ new Set();
    const open = () => {
      opened = true;
      for (const listener of listeners) listener(opened);
    };
    const close = () => {
      opened = false;
      for (const listener of listeners) listener(opened);
    };
    const api = async (action, settings) => {
      const response = await scope.remote.trainingLens.control(
        JSON.stringify({ action, ...settings ? { settings } : {} })
      );
      if (!response.ok) throw response.error;
      const result = JSON.parse(response.value);
      if (!result.ok) throw new Error(result.message);
      return result.value;
    };
    api.isLocal = () => scope.remote.$host?.isLoopback === true;
    const Button = ({ t, subject }) => {
      if (subject && subject.pkg?.name !== "dsh-training-lens") return null;
      return h(
        "button",
        {
          type: "button",
          style: buttonStyle,
          onClick: open,
          "aria-label": t("title")
        },
        "\u25C9 ",
        t("title")
      );
    };
    const Overlay = ({ t }) => {
      const [visible, setVisible] = (0, import_react.useState)(opened);
      (0, import_react.useEffect)(() => {
        listeners.add(setVisible);
        return () => listeners.delete(setVisible);
      }, []);
      return visible ? h(LensPanel, { t, api, close }) : null;
    };
    for (const slot of ["sidebar.footer.action", "plugins.detail.actions"]) {
      scope.slots.inject(
        slot,
        () => scope.slots.register(
          {
            name: slot,
            id: "training-lens",
            locale: "trainingLens",
            order: 60
          },
          Button
        )
      );
    }
    scope.slots.inject(
      "shell.overlay",
      () => scope.slots.register(
        { name: "shell.overlay", id: "training-lens", locale: "trainingLens" },
        Overlay
      )
    );
  });
}
return module.exports; }});
