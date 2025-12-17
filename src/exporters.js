import { jsPDF } from 'jspdf'
import { downloadBlob } from './utils.js'

export function exportPng(stage, filename = 'floorplan.png', pixelRatio = 3) {
  const dataUrl = stage.toDataURL({ pixelRatio });
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

  const pdfBlob = pdf.output('blob');
  downloadBlob(pdfBlob, filename);
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
