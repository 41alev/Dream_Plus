// Ambient types for browser globals that come from classic <script> tags or
// from browser APIs that lib.dom does not describe yet. The shared app
// globals (Api, UI, App, I18N) are NOT declared here: TypeScript infers them
// from public/js/*.js, which load as plain scripts (see tsconfig
// "moduleDetection": "auto").
export {};

declare global {
  interface Window {
    // Shared React runtime published by frontend-react/vendor-react.js.
    React: unknown;
    ReactDOM: unknown;
    ReactJSXRuntime: unknown;
    // Lazily loaded screen bundles register themselves as window.View<Name>.
    [screen: `View${string}`]: unknown;
  }

  // Chart.js UMD build is loaded from public/vendor by index.html.
  const Chart: any;

  // Swagger UI is loaded from public/vendor by api-docs.html.
  const SwaggerUIBundle: any;

  // Shape Detection API (Chrome/Edge). Callers feature-detect it first.
  class BarcodeDetector {
    constructor(options?: { formats?: string[] });
    detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
    static getSupportedFormats(): Promise<string[]>;
  }

  // Project assumption: every selector query in this app targets HTML
  // elements (no SVG/MathML is queried), so string selectors return
  // HTMLElement instead of the bare Element lib.dom must assume. Interface
  // merging puts these overloads first. Form-control members such as
  // .value/.disabled/.checked still need an explicit cast at the call site.
  interface ParentNode {
    querySelector(selectors: string): HTMLElement | null;
    querySelectorAll(selectors: string): NodeListOf<HTMLElement>;
  }
  interface Element {
    closest(selectors: string): HTMLElement | null;
  }

  /** Any form control that carries a string .value. */
  type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  /** Any control that can be disabled. */
  type FormControl = FormField | HTMLButtonElement | HTMLFieldSetElement;

  /** Error thrown by public/js/api.js request(). */
  interface ApiError extends Error {
    status?: number;
    payload?: any;
    network?: boolean;
  }
}
