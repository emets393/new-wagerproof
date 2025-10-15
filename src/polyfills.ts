// Polyfill for crypto.randomUUID() for non-HTTPS contexts
if (!crypto.randomUUID) {
  // @ts-ignore
  crypto.randomUUID = function () {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}

export {};

