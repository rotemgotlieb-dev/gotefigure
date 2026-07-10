// Vite `?inline` imports resolve to a data-URL string (used by the gated vault
// gallery route so the images never exist as public static assets).
declare module '*.jpg?inline' {
  const dataUrl: string;
  export default dataUrl;
}
