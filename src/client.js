import React, { useEffect, useRef, useState } from "react";
import { TYPERT_REMOTE } from "./wire.js";

const h = React.createElement;
const copy = {
  title: ["训练视窗", "Training Lens"],
  close: ["关闭面板", "Close panel"],
  connection: ["连接与启动设置", "Connection and startup settings"],
  intro: [
    "选好日志目录后，一键启动和查看，不用记端口。",
    "Choose your log directory, then start and view without remembering a port.",
  ],
  logdir: [
    "TensorBoard 日志目录（绝对路径）",
    "TensorBoard log directory (absolute path)",
  ],
  python: ["训练环境 Python", "Training environment Python"],
  mode: ["自动启动", "Automatic startup"],
  manual: ["手动启动", "Manual"],
  startup: ["随 DSH 启动", "When DSH starts"],
  activity: ["检测到日志写入时启动", "When TensorBoard logs change"],
  activityHint: [
    "每 5 秒检查指定目录。检测的是日志写入，不代表训练进程健康。目录可以稍后由训练器创建。",
    "Checks the selected directory every 5 seconds. Log writes do not certify trainer health. Your trainer may create the directory later.",
  ],
  save: ["保存设置", "Save settings"],
  saved: ["设置已保存", "Settings saved"],
  start: ["启动并查看", "Start and view"],
  stop: ["停止监控", "Stop dashboard"],
  open: ["在新标签页打开", "Open in new tab"],
  loading: ["处理中…", "Working…"],
  running: ["监控运行中", "Dashboard running"],
  stopped: ["监控未启动", "Dashboard stopped"],
  watching: ["等待日志写入", "Waiting for log writes"],
  unreachable: ["监控暂时无法连接", "Dashboard is unreachable"],
  pause: [
    "本次会话的自动启动已暂停；保存设置可恢复。",
    "Automatic startup is paused for this session; save settings to resume.",
  ],
  persist: [
    "当前宿主没有提供保存位置，设置仅在本次会话生效。",
    "This host has no settings location; changes last for this session only.",
  ],
  training: [
    "停止只关闭监控，不影响训练。端口由插件自动选择。",
    "Stopping closes only the dashboard. The plugin chooses an available port.",
  ],
  remote: [
    "DSH 运行在远程主机：请先转发下方地址的端口，再在本机浏览器打开。",
    "DSH is on a remote host: forward the port below before opening it in your browser.",
  ],
  error: ["操作失败", "Operation failed"],
  preview: ["训练监控", "Training dashboard"],
};
const dictionaries = Object.fromEntries(
  ["zh", "en"].map((lang, i) => [
    lang,
    Object.fromEntries(
      Object.entries(copy).map(([key, values]) => [key, values[i]]),
    ),
  ]),
);
const buttonStyle = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #7f8b9b55",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 8,
  border: "1px solid #7f8b9b66",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};
const defaults = { python: "python", logdir: "", port: 0, startMode: "manual" };

export function dashboardUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port &&
      !url.username &&
      !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function LensPanel({ t, api, close }) {
  const [data, setData] = useState(null),
    [settings, setSettings] = useState(defaults);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const live = useRef(true),
    busyRef = useRef(false),
    loaded = useRef(false),
    closeButton = useRef(null);
  useEffect(() => {
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
    const timer = setInterval(poll, 5000);
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
  const active = data && data.state !== "stopped",
    url = dashboardUrl(data?.url);
  const local = api.isLocal();
  const label =
    data?.state === "running"
      ? "running"
      : data?.state === "unreachable"
        ? "unreachable"
        : data?.watching
          ? "watching"
          : "stopped";
  const field = (key, text, control) =>
    h(
      "label",
      { style: { display: "grid", gap: 5 } },
      h("span", null, t(text)),
      control ||
        h("input", {
          "aria-label": t(text),
          value: settings[key],
          disabled: busy || active,
          style: inputStyle,
          onChange: (event) =>
            setSettings((old) => ({ ...old, [key]: event.target.value })),
        }),
    );
  return h(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#0007",
        display: "grid",
        placeItems: "center",
        padding: 16,
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) close();
      },
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
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],iframe",
              ),
            ];
            const first = controls[0],
              last = controls.at(-1);
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
          fontSize: 14,
        },
      },
      h(
        "header",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          },
        },
        h("h2", { style: { margin: 0 } }, t("title")),
        h(
          "button",
          { ref: closeButton, style: buttonStyle, onClick: close },
          t("close"),
        ),
      ),
      h("p", null, t("intro")),
      h(
        "details",
        { open: !active, style: { margin: "12px 0" } },
        h(
          "summary",
          { style: { cursor: "pointer", marginBottom: 12 } },
          t("connection"),
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 12,
            },
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
                onChange: (event) =>
                  setSettings((old) => ({
                    ...old,
                    startMode: event.target.value,
                  })),
              },
              ...["manual", "startup", "activity"].map((mode) =>
                h("option", { key: mode, value: mode }, t(mode)),
              ),
            ),
          ),
        ),
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
            marginTop: 16,
          },
        },
        h(
          "button",
          {
            style: buttonStyle,
            disabled: busy || !data,
            onClick: () => act("save"),
          },
          t("save"),
        ),
        h(
          "button",
          {
            style: { ...buttonStyle, background: "#2c6b58", color: "white" },
            disabled: busy || !data || active,
            onClick: () => act("start"),
          },
          t("start"),
        ),
        h(
          "button",
          {
            style: buttonStyle,
            disabled: busy || !data || (!active && !data?.watching),
            onClick: () => act("stop"),
          },
          t("stop"),
        ),
        url &&
          local &&
          h(
            "a",
            {
              style: buttonStyle,
              href: url,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            t("open"),
          ),
        h("span", { role: "status" }, busy ? t("loading") : t(label)),
      ),
      (error || data?.error) &&
        h(
          "p",
          {
            role: "alert",
            style: { color: "#cf493b", overflowWrap: "anywhere" },
          },
          error || data.error,
        ),
      notice && h("p", { role: "status" }, notice),
      data?.autoPaused &&
        settings.startMode !== "manual" &&
        h("p", null, t("pause")),
      data && !data.persistent && h("p", null, t("persist")),
      h("p", { style: { opacity: 0.75 } }, t("training")),
      url && !local && h("p", null, t("remote"), " ", h("code", null, url)),
      url &&
        local &&
        data?.state === "running" &&
        h("iframe", {
          key: url,
          src: `${url}/?embedded=1`,
          title: t("preview"),
          style: {
            width: "100%",
            height: "55vh",
            minHeight: 300,
            border: "1px solid #7f8b9b55",
            borderRadius: 10,
          },
        }),
    ),
  );
}

export const inject = ["slots", "locale", "remote"];
export async function apply(ctx) {
  ctx.effect(() => ctx.locale.register("trainingLens", dictionaries));
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => unmount);
  ctx.inject(["remote.trainingLens"], (scope) => {
    let opened = false;
    const listeners = new Set();
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
        JSON.stringify({ action, ...(settings ? { settings } : {}) }),
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
          "aria-label": t("title"),
        },
        "◉ ",
        t("title"),
      );
    };
    const Overlay = ({ t }) => {
      const [visible, setVisible] = useState(opened);
      useEffect(() => {
        listeners.add(setVisible);
        return () => listeners.delete(setVisible);
      }, []);
      return visible ? h(LensPanel, { t, api, close }) : null;
    };
    for (const slot of ["sidebar.footer.action", "plugins.detail.actions"]) {
      scope.slots.inject(slot, () =>
        scope.slots.register(
          {
            name: slot,
            id: "training-lens",
            locale: "trainingLens",
            order: 60,
          },
          Button,
        ),
      );
    }
    scope.slots.inject("shell.overlay", () =>
      scope.slots.register(
        { name: "shell.overlay", id: "training-lens", locale: "trainingLens" },
        Overlay,
      ),
    );
  });
}
