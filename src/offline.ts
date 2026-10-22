export async function offlineStatus(element: HTMLElement) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    element.textContent = "Development preview";
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const channel = new MessageChannel();
  let expired = false;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new Error("Offline installation or inspection timed out"));
      }, 8000);
    });
    const inspect = async () => {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const registration = await navigator.serviceWorker.ready;
      if (expired) throw new Error("Offline inspection expired");
      return new Promise<{ complete: boolean; edition: string }>((resolve) => {
        channel.port1.onmessage = (event) => resolve(event.data);
        registration.active?.postMessage({ type: "SHIGUZHAI_INSPECT" }, [channel.port2]);
      });
    };
    const saved = await Promise.race([inspect(), timeout]);
    element.textContent =
      saved.complete && saved.edition === __SHIGUZHAI_EDITION__
        ? "Bells & evidence saved offline"
        : "Offline edition is updating. Reload online to finish.";
  } catch {
    element.textContent = "Offline download unavailable; exhibit still works online";
  } finally {
    clearTimeout(timer);
    channel.port1.close();
    channel.port2.close();
  }
}
