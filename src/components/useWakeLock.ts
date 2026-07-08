import { useEffect } from "react";

/**
 * active の間、画面が自動消灯しないよう Screen Wake Lock を要求する。
 * タブが非表示になるとロックは OS 側で解放されるため、復帰時に再取得する。
 * 非対応環境(古い iOS 等)では何もしない。
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;

    const request = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) await l.release();
        else lock = l;
      } catch {
        // 省電力モード等で拒否されることがあるが、消灯するだけで実害はない
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
