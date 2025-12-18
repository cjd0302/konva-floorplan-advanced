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

export function downloadJson(jsonObj, filename = 'floorplan.domain.json') {
  const jsonStr = typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj, null, 2);

  // ✅ Android WebView: 네이티브로 저장 요청 (blob 다운로드 금지)
  // if (isAndroidWebView() && window.MNative?.saveBase64File) {
  //   const base64 = toBase64Utf8(jsonStr);
  //   window.MNative.saveBase64File(base64, filename, 'application/json');
  //   return;
  // }

  // ✅ (임시) 브릿지 이름이 다른 경우도 대비 (Morpheus 계열)
  if (isAndroidWebView()) {
    console.log("Android Webview!!!!");
    const base64 = toBase64Utf8(jsonStr);
    let result = M.execute("exWNSaveBase64File", base64, filename, 'application/json');
    if(result != "" && result != null && result != undefined){
      alert("Export 되었습니다.")
    }
    // window.M.file.saveBase64({ base64, filename, mime: 'application/json' });
    return;
  }

  // ✅ 일반 브라우저: 기존 방식 그대로 다운로드
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
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


export function toBase64Utf8(str) {
  // UTF-8 안전 base64 인코딩 (한글/특수문자 포함)
  const utf8 = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < utf8.length; i += chunk) {
    binary += String.fromCharCode(...utf8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function isAndroidWebView() {
  const ua = navigator.userAgent || '';
  // 대충: Android + wv(웹뷰) 또는 Version/... + Chrome/... 조합
  return (/Android/i.test(ua) && (/\bwv\b/i.test(ua) || /Version\/\d+\.\d+.*Chrome\/\d+/i.test(ua))) || /Morpheus/i.test(ua);
}
