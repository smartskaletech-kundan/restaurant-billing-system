// xlsx is loaded from CDN to avoid bundling issues.
// We start loading it immediately when this module is first imported.
// By the time a user clicks Import/Export, it should already be ready.

type XLSXType = typeof import("xlsx");

let _xlsx: XLSXType | null = null;
let _loadPromise: Promise<XLSXType> | null = null;

function loadXLSX(): Promise<XLSXType> {
  if (_xlsx) return Promise.resolve(_xlsx);
  if (_loadPromise) return _loadPromise;

  // Check if already available (e.g. from a previous script load)
  const win = window as unknown as Record<string, unknown>;
  if (win.XLSX) {
    _xlsx = win.XLSX as XLSXType;
    return Promise.resolve(_xlsx);
  }

  _loadPromise = new Promise<XLSXType>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      _xlsx = (window as unknown as Record<string, unknown>).XLSX as XLSXType;
      resolve(_xlsx);
    };
    script.onerror = () => reject(new Error("Failed to load xlsx library"));
    document.head.appendChild(script);
  });

  return _loadPromise;
}

// Start loading eagerly so it's ready when the user clicks Import/Export
if (typeof window !== "undefined") {
  loadXLSX().catch(() => {
    // Silently ignore prefetch errors; will retry on actual use
  });
}

/**
 * Get the xlsx library. Always use this in async handlers before calling XLSX methods.
 */
export async function getXLSX(): Promise<XLSXType> {
  return loadXLSX();
}

/**
 * Synchronous access proxy — works after getXLSX() has resolved.
 * For new code, prefer getXLSX() in async event handlers.
 */
export const XLSX = new Proxy({} as XLSXType, {
  get(_target, prop) {
    if (_xlsx) {
      return (_xlsx as unknown as Record<string | symbol, unknown>)[prop];
    }
    throw new Error(
      `xlsx not ready yet — call await getXLSX() before using XLSX.${String(prop)}`,
    );
  },
});

export default XLSX;
