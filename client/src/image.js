// Redraws every photo before upload. That strips hidden metadata such as the
// GPS location a phone stores in the file, shrinks big photos for cell data,
// and converts iPhone HEIC photos to JPEG (Safari can decode HEIC; the server can't).

const MAX_SIDE = 2000;
const QUALITY = 0.85;

export async function prepareUpload(file) {
  if (!file.type.startsWith("image/")) return file; // PDFs go as-is
  // Small PNGs (usually screenshots) stay PNG so text stays crisp.
  const png = file.type === "image/png" && file.size < 1.5 * 1024 * 1024;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = png ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + (png ? ".png" : ".jpg"), { type });
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
