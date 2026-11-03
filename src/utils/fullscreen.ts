interface VendorDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

export function getActiveFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as VendorDocument;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as VendorDocument;
  const el = document.documentElement as VendorElement;
  return Boolean(
    (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true) &&
      (el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen)
  );
}

/**
 * Must be invoked synchronously inside a direct click/touch handler (no preceding await!)
 * so transient user activation is preserved across mobile & desktop browsers.
 */
export function requestAppFullscreenSync(): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const el = document.documentElement as VendorElement;

  const lockLandscape = () => {
    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      };
      if (orientationApi?.lock) {
        orientationApi.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock optional fallback
    }
  };

  if (getActiveFullscreenElement()) {
    lockLandscape();
    return Promise.resolve(true);
  }

  try {
    let req: Promise<void> | void | undefined;
    if (el.requestFullscreen) {
      req = el.requestFullscreen({ navigationUI: 'hide' });
    } else if (el.webkitRequestFullscreen) {
      req = el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      req = el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      req = el.msRequestFullscreen();
    } else {
      return Promise.resolve(false);
    }

    if (req && typeof (req as Promise<void>).then === 'function') {
      return (req as Promise<void>)
        .then(() => {
          lockLandscape();
          return true;
        })
        .catch(() => false);
    }
    lockLandscape();
    return Promise.resolve(Boolean(getActiveFullscreenElement()));
  } catch {
    return Promise.resolve(false);
  }
}

export function exitAppFullscreenSync(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const doc = document as VendorDocument;
  if (!getActiveFullscreenElement()) return Promise.resolve();

  try {
    if (doc.exitFullscreen) {
      return doc.exitFullscreen().catch(() => {});
    }
    if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  } catch {
    // Ignore errors
  }
  return Promise.resolve();
}
