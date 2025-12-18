import { jsPDF } from 'jspdf'
import { downloadBlob, isAndroidWebView } from './utils.js'

export function exportPng(stage, filename = 'floorplan.png', pixelRatio = 3) {
  const dataUrl = stage.toDataURL({ pixelRatio });
  if (isAndroidWebView()) {
    const base64 = stripDataUrlHeader(dataUrl)
    let result = M.execute("exWNSaveBase64File", base64, filename, 'image/png');
    if(result != "" && result != null && result != undefined){
      alert("Export 되었습니다.")
    }
    return
  }

  fetch(dataUrl).then(r => r.blob()).then(blob => downloadBlob(blob, filename));
}

export async function exportPdf(stage, filename = 'floorplan.pdf', pixelRatio = 3) {
  const dataUrl = stage.toDataURL({ pixelRatio });
  const imgBlob = await (await fetch(dataUrl)).blob();
  const imgDataUrl = await blobToDataURL(imgBlob);
  const { width, height } = await getImageSize(imgDataUrl);
 
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height]
  });
  pdf.addImage(imgDataUrl, 'PNG', 0, 0, width, height);

  if (isAndroidWebView()) {
    const ab = pdf.output('arraybuffer')
    const base64 = await blobToBase64Body(new Blob([ab], { type: 'application/pdf' }))
    
    let result = M.execute("exWNSaveBase64File", base64, filename, 'application/pdf');
    if(result != "" && result != null && result != undefined){
      alert("Export 되었습니다.")
    }
  }

  const pdfBlob = pdf.output('blob');
  downloadBlob(pdfBlob, filename);
}

// dataURL("data:image/png;base64,....") -> base64 본문만
function stripDataUrlHeader(dataUrl) {
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
}

// Blob -> base64(본문만)
async function blobToBase64Body(blob) {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function getImageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
