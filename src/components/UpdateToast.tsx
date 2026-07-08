import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Service Worker の更新トースト。
 * registerType: "prompt"(vite.config.ts)と対で、新バージョン検出時に
 * 「更新する」を押した時だけリロードする。対局中の強制リロードを防ぐため
 * autoUpdate は使わない。「あとで」を押しても次回起動時に再提示される。
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="alert">
      <span>新しいバージョンがあります</span>
      <button
        type="button"
        className="update-toast-apply"
        onClick={() => updateServiceWorker(true)}
      >
        更新する
      </button>
      <button
        type="button"
        className="update-toast-later"
        onClick={() => setNeedRefresh(false)}
      >
        あとで
      </button>
    </div>
  );
}
