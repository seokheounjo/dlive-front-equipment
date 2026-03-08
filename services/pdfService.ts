/**
 * PDF Generation Service
 * 은행 자동이체 신청서 PDF 생성 (D'LIVE 양식)
 */
import { jsPDF } from 'jspdf';

interface AutoTransferPdfData {
  // 고객 정보
  custId: string;
  custNm: string;
  pymAcntId: string;

  // 변경 정보
  pymMthNm?: string;
  changeReasonNm?: string;
  acntHolderNm: string;    // 예금주명
  idTypeNm?: string;
  birthDt: string;         // 생년월일 (6자리 또는 13자리)
  bankNm: string;          // 은행명
  acntNo: string;          // 계좌번호
  pyrRelNm?: string;

  // 서명 이미지 (base64)
  signatureData?: string;

  // 생성일시
  createdAt?: string;
}

interface TextImageResult {
  dataUrl: string;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Canvas를 이용하여 한글 텍스트를 이미지로 변환
 * 캔버스 실제 크기를 함께 반환하여 PDF 삽입 시 비율 유지
 */
function textToImage(
  text: string,
  fontSize: number = 12,
  fontWeight: string = 'normal',
  color: string = '#000000',
  align: CanvasTextAlign = 'left',
  maxWidthMm?: number
): TextImageResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const scale = 4; // 고해상도
  const font = `${fontWeight} ${fontSize * scale}px "Malgun Gothic", "맑은 고딕", sans-serif`;
  ctx.font = font;

  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width) + scale * 4; // 좌우 패딩

  // maxWidthMm이 지정되면 해당 mm를 px로 변환 (1mm ≈ 3.78px, scale 적용)
  const mmToPx = 3.78 * scale;
  const canvasWidth = maxWidthMm ? Math.max(textWidth, Math.ceil(maxWidthMm * mmToPx)) : textWidth;
  const canvasHeight = Math.ceil(fontSize * scale * 1.5);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 투명 배경
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  if (align === 'center') {
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(text, scale * 2, canvas.height / 2);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    canvasWidth,
    canvasHeight,
  };
}

/**
 * 이미지를 PDF에 비율 유지하면서 삽입
 * targetWidthMm 기준으로 높이를 자동 계산
 */
function addImageKeepRatio(
  doc: jsPDF,
  img: TextImageResult,
  x: number,
  y: number,
  targetWidthMm: number,
  maxHeightMm?: number
) {
  const ratio = img.canvasHeight / img.canvasWidth;
  let displayWidth = targetWidthMm;
  let displayHeight = targetWidthMm * ratio;

  // 최대 높이 제한
  if (maxHeightMm && displayHeight > maxHeightMm) {
    displayHeight = maxHeightMm;
    displayWidth = maxHeightMm / ratio;
  }

  doc.addImage(img.dataUrl, 'PNG', x, y, displayWidth, displayHeight);
  return { width: displayWidth, height: displayHeight };
}

/**
 * 셀 안에 텍스트 이미지를 수직 중앙 배치
 */
function addTextInCell(
  doc: jsPDF,
  text: string,
  fontSize: number,
  fontWeight: string,
  color: string,
  align: CanvasTextAlign,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  paddingX: number = 3
) {
  const img = textToImage(text, fontSize, fontWeight, color, align, align === 'center' ? cellWidth : undefined);

  // 비율 유지한 표시 높이 계산
  const ratio = img.canvasHeight / img.canvasWidth;
  const availWidth = align === 'center' ? cellWidth : cellWidth - paddingX * 2;
  let displayWidth = availWidth;
  let displayHeight = availWidth * ratio;

  // 텍스트가 셀보다 높으면 셀 높이에 맞춤
  const maxH = cellHeight - 2;
  if (displayHeight > maxH) {
    displayHeight = maxH;
    displayWidth = maxH / ratio;
  }

  // 수직 중앙
  const offsetY = (cellHeight - displayHeight) / 2;
  const drawX = align === 'center' ? cellX : cellX + paddingX;

  doc.addImage(img.dataUrl, 'PNG', drawX, cellY + offsetY, displayWidth, displayHeight);
}

/**
 * 생년월일 마스킹: 890814 → 890814-******
 */
function maskBirthDt(birthDt: string): string {
  if (!birthDt) return '-';
  if (birthDt.length >= 13) {
    return birthDt.slice(0, 6) + '-******';
  }
  if (birthDt.length === 6) {
    return birthDt + '-******';
  }
  if (birthDt.length === 8) {
    return birthDt.slice(2, 8) + '-******';
  }
  return birthDt;
}

/**
 * D'LIVE 은행 자동이체 신청서 PDF 생성
 */
export async function generateAutoTransferPdf(data: AutoTransferPdfData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');

  // 테이블 설정
  const tableLeft = 30;
  const tableWidth = 150;
  const labelWidth = 45;
  const valueLeft = tableLeft + labelWidth;
  const valueWidth = tableWidth - labelWidth;
  const rowHeight = 14;  // 기본 행 높이 (넉넉하게)

  let y = 35;

  // === 타이틀 헤더 바 ===
  const titleHeight = 16;
  doc.setFillColor(0, 150, 180);
  doc.rect(tableLeft, y, tableWidth, titleHeight, 'F');

  addTextInCell(doc, '은행 자동이체 신청서', 14, 'bold', '#FFFFFF', 'center',
    tableLeft, y, tableWidth, titleHeight);
  y += titleHeight;

  // === 테이블 행 데이터 ===
  const rows = [
    { label: '납부자명', value: data.custNm || '-' },
    { label: '납부계정', value: data.pymAcntId || '-' },
    { label: '은행명', value: data.bankNm || '-' },
    { label: '계좌번호', value: data.acntNo || '-' },
    { label: '예금주명', value: data.acntHolderNm || '-' },
    { label: '생년월일/사업자번호', value: maskBirthDt(data.birthDt) },
    { label: '신청일자', value: formatDate(data.createdAt) },
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rh = rowHeight;

    // 라벨 배경 (연한 회색)
    doc.setFillColor(245, 245, 245);
    doc.rect(tableLeft, y, labelWidth, rh, 'F');

    // 값 배경 (흰색)
    doc.setFillColor(255, 255, 255);
    doc.rect(valueLeft, y, valueWidth, rh, 'F');

    // 테두리
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.3);
    doc.rect(tableLeft, y, labelWidth, rh);
    doc.rect(valueLeft, y, valueWidth, rh);

    // 라벨 텍스트 (중앙 정렬, 비율 유지)
    addTextInCell(doc, row.label, 9, 'normal', '#333333', 'center',
      tableLeft, y, labelWidth, rh);

    // 값 텍스트 (좌측 정렬, 비율 유지)
    addTextInCell(doc, row.value, 10, 'normal', '#000000', 'left',
      valueLeft, y, valueWidth, rh, 5);

    y += rh;
  }

  // === 전자서명 행 ===
  const signatureRowHeight = 45;

  // 라벨
  doc.setFillColor(245, 245, 245);
  doc.rect(tableLeft, y, labelWidth, signatureRowHeight, 'F');
  doc.setDrawColor(190, 190, 190);
  doc.rect(tableLeft, y, labelWidth, signatureRowHeight);

  addTextInCell(doc, '전자서명', 10, 'normal', '#333333', 'center',
    tableLeft, y, labelWidth, signatureRowHeight);

  // 서명 값 영역
  doc.setFillColor(255, 255, 255);
  doc.rect(valueLeft, y, valueWidth, signatureRowHeight, 'F');
  doc.setDrawColor(190, 190, 190);
  doc.rect(valueLeft, y, valueWidth, signatureRowHeight);

  if (data.signatureData) {
    try {
      // 서명 이미지: 여백 두고 비율 유지
      const sigPad = 6;
      const sigMaxW = valueWidth - sigPad * 2;
      const sigMaxH = signatureRowHeight - sigPad * 2;

      // 서명 이미지 원본 크기 파악을 위해 임시 Image 사용
      const sigImg = new Image();
      sigImg.src = data.signatureData;
      // 동기로 처리 (이미 base64이므로 로드 완료 상태)
      let sigW = sigMaxW;
      let sigH = sigMaxH;
      if (sigImg.naturalWidth && sigImg.naturalHeight) {
        const sigRatio = sigImg.naturalHeight / sigImg.naturalWidth;
        sigW = sigMaxW;
        sigH = sigMaxW * sigRatio;
        if (sigH > sigMaxH) {
          sigH = sigMaxH;
          sigW = sigMaxH / sigRatio;
        }
      }
      const sigX = valueLeft + (valueWidth - sigW) / 2;
      const sigY = y + (signatureRowHeight - sigH) / 2;
      doc.addImage(data.signatureData, 'PNG', sigX, sigY, sigW, sigH);
    } catch (e) {
      console.warn('Signature image insert failed:', e);
      addTextInCell(doc, '(서명 삽입 실패)', 9, 'normal', '#999999', 'center',
        valueLeft, y, valueWidth, signatureRowHeight);
    }
  } else {
    addTextInCell(doc, '(서명 없음)', 9, 'normal', '#999999', 'center',
      valueLeft, y, valueWidth, signatureRowHeight);
  }

  y += signatureRowHeight;

  // === 하단 안내문구 ===
  y += 8;
  addTextInCell(doc, '위와 같이 자동이체를 신청합니다.', 10, 'normal', '#555555', 'center',
    tableLeft, y, tableWidth, 10);
  y += 14;

  // === 하단 로고/사명 ===
  addTextInCell(doc, "D'LIVE (주)딜라이브", 12, 'bold', '#333333', 'center',
    tableLeft, y, tableWidth, 10);

  return doc.output('blob');
}

/**
 * 날짜 포맷: YYYY.MM.DD
 */
function formatDate(dateStr?: string): string {
  if (dateStr) return dateStr;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * PDF Blob을 다운로드 (모바일/PC 모두 지원)
 */
export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * PDF Blob을 서버 디렉토리에 저장
 */
export async function savePdfToServer(blob: Blob, filename: string): Promise<{ success: boolean; filePath?: string; message?: string }> {
  try {
    // Blob -> base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const pdfBase64 = btoa(binary);

    const response = await fetch('/api/customer/payment/savePdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, pdfData: pdfBase64 }),
    });

    const result = await response.json();
    return { success: result.success, filePath: result.data?.filePath, message: result.message };
  } catch (error: any) {
    console.error('[savePdfToServer] Error:', error);
    return { success: false, message: error?.message || 'PDF server save failed' };
  }
}
