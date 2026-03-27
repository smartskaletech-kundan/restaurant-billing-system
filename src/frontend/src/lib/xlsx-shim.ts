// xlsx is loaded via CDN in index.html as a global (window.XLSX)
// This shim re-exports it for typed use in modules.

declare global {
  interface Window {
    XLSX: any;
  }
}

export const XLSX = typeof window !== "undefined" ? (window as any).XLSX : null;

export default XLSX;
