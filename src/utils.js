export function uid(prefix="ID") {
  const s = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${s}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

export async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx*dx + dy*dy;
}

export function closestPointOnSegment(A, B, P) {
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const wx = P.x - A.x;
  const wy = P.y - A.y;
  const c1 = vx*wx + vy*wy;
  if (c1 <= 0) return { x: A.x, y: A.y, t: 0 };
  const c2 = vx*vx + vy*vy;
  if (c2 <= c1) return { x: B.x, y: B.y, t: 1 };
  const t = c1 / c2;
  return { x: A.x + t*vx, y: A.y + t*vy, t };
}

export function angleDeg(A, B) {
  const rad = Math.atan2(B.y - A.y, B.x - A.x);
  return rad * 180 / Math.PI;
}
