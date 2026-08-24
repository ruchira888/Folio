/**
 * Polyfill for async-iterating a ReadableStream.
 *
 * pdf.js's `getTextContent()` runs `for await (const value of readableStream)`,
 * which needs `ReadableStream.prototype[Symbol.asyncIterator]`. safari shipped
 * that late, so on older safari it is undefined and the loop throws
 * "undefined is not a function". this adds the missing method when absent, so
 * text extraction works there too. chrome, node and new safari already have it
 * and are left untouched.
 */
export function installReadableStreamAsyncIterator(): void {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: unknown;
  };
  if (proto[Symbol.asyncIterator]) return;

  proto[Symbol.asyncIterator] = function (
    this: ReadableStream,
  ): AsyncIterableIterator<unknown> {
    const reader = this.getReader();
    return {
      next() {
        return reader.read() as Promise<IteratorResult<unknown>>;
      },
      return(value?: unknown) {
        reader.releaseLock();
        return Promise.resolve({ done: true, value });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
}
