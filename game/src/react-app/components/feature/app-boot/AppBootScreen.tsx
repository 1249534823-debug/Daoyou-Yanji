import { InkLoadingBar } from '@app/components/ui/InkLoadingBar';

export function AppBootScreen() {
  return (
    <div
      className="app-boot-screen"
      role="status"
      aria-live="polite"
      aria-label="万界道友•衍极界正在加载"
    >
      <div className="app-boot-content">
        <img
          aria-hidden="true"
          alt=""
          className="app-boot-logo"
          src="/assets/app-boot/boot-logo.webp"
          draggable={false}
          fetchPriority="high"
        />
        <div className="app-boot-title-lockup" aria-hidden="true">
          <img
            alt=""
            className="app-boot-title-image"
            src="/assets/app-boot/boot-title-wanjie-yanji.svg"
            draggable={false}
            fetchPriority="high"
          />
          <img
            alt=""
            className="app-boot-seal-image"
            src="/assets/app-boot/boot-seal-wanjie-yanji.svg"
            draggable={false}
            fetchPriority="high"
          />
        </div>
        <InkLoadingBar size="boot" immediate />
        <img
          aria-hidden="true"
          alt=""
          className="app-boot-message-image"
          src="/assets/app-boot/boot-message-wanjie-yanji.svg"
          draggable={false}
        />
      </div>
      <div className="app-boot-motto" aria-hidden="true">
        <span />
        <img
          alt=""
          src="/assets/app-boot/boot-motto-wanjie-yanji.svg"
          draggable={false}
        />
        <span />
      </div>
    </div>
  );
}
