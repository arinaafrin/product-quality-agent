import '@testing-library/jest-dom/vitest';

// jsdom's Blob/File implementation doesn't include text()/arrayBuffer()/stream()
// (a long-standing jsdom limitation: https://github.com/jsdom/jsdom/issues/2555).
// Dashboard.jsx reads uploaded files with `await file.text()`, so polyfill it here
// using the FileReader API, which jsdom does implement.
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function text() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
