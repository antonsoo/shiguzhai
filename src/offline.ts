export async function offlineStatus(element: HTMLElement) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    element.textContent = import.meta.env.PROD
      ? "Offline saving unavailable in this browser"
      : "Development preview";
    return;
  }
  let registration: ServiceWorkerRegistration;
  let inspection = 0;
  let failed = false;
  const pending = () => Boolean(registration?.installing || registration?.waiting);
  const inspect = async () => {
    const attempt = ++inspection;
    // During replacement the active worker belongs to the previous edition.
    // Do not extend its lifetime with inspection messages while its successor
    // is trying to activate; wait for controllerchange instead.
    if (pending()) {
      element.textContent = registration.active
        ? "Downloading the updated bells & evidence…"
        : "Downloading bells & evidence for offline use…";
      return;
    }
    const worker = navigator.serviceWorker.controller;
    if (!worker || worker !== registration.active || worker.state !== "activated") {
      element.textContent = failed
        ? "Offline download unavailable; exhibit still works online"
        : "Finishing the offline installation…";
      return;
    }
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const saved = await new Promise<{ complete: boolean; edition: string }>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Offline inspection timed out")), 4000);
        channel.port1.onmessage = (event) => resolve(event.data);
        worker.postMessage({ type: "SHIGUZHAI_INSPECT" }, [channel.port2]);
      });
      if (attempt !== inspection || worker !== navigator.serviceWorker.controller) return;
      element.textContent =
        saved.complete && saved.edition === __SHIGUZHAI_EDITION__
          ? "Bells & evidence saved offline"
          : pending()
            ? "Downloading the updated bells & evidence…"
            : failed
              ? "Offline update incomplete; reload online to retry."
              : "A different offline edition is saved. Reload online to finish updating.";
    } catch {
      if (attempt === inspection)
        element.textContent = "Offline download unavailable; exhibit still works online";
    } finally {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
    }
  };
  const watched = new WeakSet<ServiceWorker>();
  const watch = () => {
    for (const worker of [
      registration.installing,
      registration.waiting,
      registration.active,
      navigator.serviceWorker.controller,
    ]) {
      if (!worker) continue;
      // A completed replacement may be waiting when registration resolves.
      // The worker accepts this only after its integrity-checked install succeeds.
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
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    // Download duration is not an installation failure. Observe the lifecycle
    // so a long scan download can finish without requiring a page reload.
    registration.addEventListener("updatefound", watch);
    navigator.serviceWorker.addEventListener("controllerchange", watch);
    watch();
    await inspect();
  } catch {
    element.textContent = "Offline download unavailable; exhibit still works online";
  }
}
