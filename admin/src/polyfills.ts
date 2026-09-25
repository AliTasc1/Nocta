// Eski Safari sürümleri için küçük dolgu (Array.prototype.at)
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function <T>(this: T[], n: number) { const i = Math.trunc(n) || 0; return this[i < 0 ? this.length + i : i]; },
    writable: true, configurable: true,
  });
}

export {};
