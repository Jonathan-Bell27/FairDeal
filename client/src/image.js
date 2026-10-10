// Shrinks phone photos before upload: faster on cell data, and it converts
// iPhone HEIC photos to JPEG (Safari can decode HEIC; the server can't).

const MAX_SIDE = 2000;
const QUALITY = 0.85;

export async function prepareUpload(file) {
  if (!file.type.startsWith("image/")) return file; // PDFs go as-is
  const isSmallJpegOrPng = /image\/(jpeg|png)/.test(file.type) && file.size < 1.5 * 1024 * 1024;
  if (isSmallJpegOrPng) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // let the server decide
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read image"));
    };
    img.src = url;
  });
}
