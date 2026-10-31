interface Inventory {
  type: string;
  complete: boolean;
  edition: string;
  files: number;
}
export async function offlineStatus(element: HTMLElement) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    element.textContent = import.meta.env.PROD
      ? "Offline saving unavailable in this browser"
      : "Development preview";
    return;
  }
  const action = document.createElement("button");
  action.type = "button";
  action.className = "offline-action";
  action.hidden = true;
  action.id = "offline-repair";
  element.after(action);
  let registration: ServiceWorkerRegistration;
  let request = 0;
  let failed = false;
  let repairPending = false;
  let actionType: "repair" | "retry" | "reload" = "repair";
  const pending = () => Boolean(registration?.installing || registration?.waiting);
  function show(text: string, kind?: typeof actionType) {
    if (element.textContent !== text) element.textContent = text;
    action.hidden = !kind;
    if (kind) {
      actionType = kind;
      action.textContent =
        kind === "reload"
          ? "Reload updated edition"
          : kind === "retry"
            ? "Retry offline saving"
            : "Repair offline files";
    }
  }
  async function message(worker: ServiceWorker, repair: boolean): Promise<Inventory> {
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<Inventory>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Offline check timed out")),
          repair ? 30000 : 12000,
        );
        channel.port1.onmessage = (event) => {
          const reply = event.data;
          if (
            reply?.type !== "SHIGUZHAI_EDITION" ||
            typeof reply.complete !== "boolean" ||
            typeof reply.edition !== "string"
          )
            reject(new Error("Offline check returned an invalid reply"));
          else resolve(reply);
        };
        worker.postMessage(
          {
            type: repair ? "SHIGUZHAI_REPAIR" : "SHIGUZHAI_INSPECT",
            edition: __SHIGUZHAI_EDITION__,
          },
          [channel.port2],
        );
      });
    } finally {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
    }
  }
  function display(saved: Inventory) {
    if (saved.edition !== __SHIGUZHAI_EDITION__) {
      show("This page and the saved edition differ. Reload to use the updated files.", "reload");
    } else if (saved.complete) show("Bells & evidence saved offline");
    else show("The offline copy is incomplete. Reconnect and repair its files.", "repair");
  }
  async function inspect(quiet = false) {
    if (repairPending) return;
    const attempt = ++request;
    if (pending()) {
      show(
        registration.active
          ? "Downloading the updated bells & evidence…"
          : "Downloading bells & evidence for offline use…",
      );
      return;
    }
    const worker = navigator.serviceWorker.controller;
    if (!worker || worker !== registration.active || worker.state !== "activated") {
      show(
        failed
          ? "Offline saving did not finish. Reconnect and retry."
          : "Finishing the offline installation…",
        failed ? "retry" : undefined,
      );
      return;
    }
    if (!quiet) show("Checking the saved bells & evidence…");
    try {
      const saved = await message(worker, false);
      if (attempt !== request || worker !== navigator.serviceWorker.controller) return;
      display(saved);
    } catch {
      if (attempt === request)
        show("Offline availability could not be confirmed. Reconnect and retry.", "retry");
    }
  }
  const watched = new WeakSet<ServiceWorker>();
  const watch = () => {
    for (const worker of [
      registration.installing,
      registration.waiting,
      registration.active,
      navigator.serviceWorker.controller,
    ]) {
      if (!worker) continue;
      if (worker.state === "installed") worker.postMessage({ type: "SHIGUZHAI_ACTIVATE" });
      if (watched.has(worker)) continue;
      watched.add(worker);
      let activated = worker.state === "activated";
      if (worker === registration.installing) failed = false;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") worker.postMessage({ type: "SHIGUZHAI_ACTIVATE" });
        if (worker.state === "activated") activated = true;
        if (worker.state === "redundant" && !activated) failed = true;
        void inspect();
      });
    }
    void inspect();
  };
  action.addEventListener("click", async () => {
    if (actionType === "reload") {
      location.reload();
      return;
    }
    if (actionType === "retry") {
      show("Retrying offline saving…");
      try {
        registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
        registration.addEventListener("updatefound", watch);
        failed = false;
        watch();
      } catch {
        show("Offline saving is unavailable. Reconnect and retry.", "retry");
      }
      return;
    }
    const worker = navigator.serviceWorker.controller;
    if (!worker) {
      void inspect();
      return;
    }
    const attempt = ++request;
    repairPending = true;
    action.disabled = true;
    show("Repairing the offline files…", "repair");
    try {
      const saved = await message(worker, true);
      if (attempt === request && worker === navigator.serviceWorker.controller) display(saved);
    } catch {
      if (attempt === request) show("Repair did not finish. Reconnect and try again.", "repair");
    } finally {
      repairPending = false;
      action.disabled = false;
      if (attempt !== request) void inspect();
    }
  });
  const recheck = () => {
    void inspect();
  };
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    registration.addEventListener("updatefound", watch);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      ++request;
      watch();
    });
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (
        event.source !== navigator.serviceWorker.controller ||
        event.data?.edition !== __SHIGUZHAI_EDITION__
      )
        return;
      if (event.data.type === "SHIGUZHAI_INVALIDATED") {
        if (!repairPending)
          show("The offline copy is incomplete. Reconnect and repair its files.", "repair");
        void inspect();
      } else if (event.data.type === "SHIGUZHAI_RESTORED") void inspect();
    });
    addEventListener("online", recheck);
    addEventListener("offline", recheck);
    addEventListener("focus", recheck);
    addEventListener("pageshow", recheck);
    addEventListener("shiguzhai:asset-failure", recheck);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) recheck();
    });
    setInterval(() => {
      if (!document.hidden) void inspect(true);
    }, 15000);
    watch();
  } catch {
    show("Offline saving is unavailable. Reconnect and reload to retry.");
  }
}
