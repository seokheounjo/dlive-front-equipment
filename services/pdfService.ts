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

/**
 * Canvas를 이용하여 한글 텍스트를 이미지로 변환
 */
function textToImage(
  text: string,
  fontSize: number = 12,
  fontWeight: string = 'normal',
  color: string = '#000000',
  align: CanvasTextAlign = 'left',
  width?: number
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const scale = 3;
  const font = `${fontWeight} ${fontSize * scale}px "Malgun Gothic", "맑은 고딕", sans-serif`;
  ctx.font = font;

  const metrics = ctx.measureText(text);
  const canvasWidth = width ? width * scale : Math.ceil(metrics.width) + 20;
  canvas.width = canvasWidth;
  canvas.height = Math.ceil(fontSize * scale * 1.6);

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
    ctx.fillText(text, 4, canvas.height / 2);
  }

  return canvas.toDataURL('image/png');
}

/**
 * 생년월일 마스킹: 890814 → 890814******
 */
function maskBirthDt(birthDt: string): string {
  if (!birthDt) return '-';
  // 13자리 주민번호 → 앞6자리 + ******
  if (birthDt.length >= 13) {
    return birthDt.slice(0, 6) + '******';
  }
  // 6자리 → 그대로 + ******
  if (birthDt.length === 6) {
    return birthDt + '******';
  }
  // 8자리 (YYYYMMDD) → YYMMDD + ******
  if (birthDt.length === 8) {
    return birthDt.slice(2, 8) + '******';
  }
  return birthDt;
}

/**
 * D'LIVE 은행 자동이체 신청서 PDF 생성
 */
export async function generateAutoTransferPdf(data: AutoTransferPdfData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const centerX = pageWidth / 2;

  // 테이블 설정
  const tableLeft = 35;
  const tableWidth = 140;
  const labelWidth = 55;
  const valueLeft = tableLeft + labelWidth;
  const valueWidth = tableWidth - labelWidth;
  const rowHeight = 12;

  let y = 40;

  // === 타이틀 헤더 바 (teal/cyan 색상) ===
  doc.setFillColor(0, 172, 193); // #00ACC1 teal
  doc.rect(tableLeft, y, tableWidth, 14, 'F');

  const titleImg = textToImage('은행 자동이체 신청서', 15, 'bold', '#FFFFFF', 'center', tableWidth);
  doc.addImage(titleImg, 'PNG', tableLeft, y + 0.5, tableWidth, 13);
  y += 14;

  // === 테이블 행들 ===
  const rows = [
    { label: '납부자명', value: data.custNm || '-' },
    { label: '납부계정', value: data.pymAcntId || '-' },
    { label: '은행명', value: data.bankNm || '-' },
    { label: '계좌번호', value: data.acntNo || '-' },
    { label: '예금주명', value: data.acntHolderNm || '-' },
    { label: '예금주\n생년월일 / 사업자번호', value: maskBirthDt(data.birthDt) },
    { label: '신청일자', value: formatDate(data.createdAt) },
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isLastBeforeSignature = i === rows.length - 1;
    const currentRowHeight = row.label.includes('\n') ? rowHeight + 4 : rowHeight;

    // 행 배경 (흰색)
    doc.setFillColor(255, 255, 255);
    doc.rect(tableLeft, y, tableWidth, currentRowHeight, 'F');

    // 라벨 배경 (연한 회색)
    doc.setFillColor(245, 245, 245);
    doc.rect(tableLeft, y, labelWidth, currentRowHeight, 'F');

    // 테두리
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(tableLeft, y, labelWidth, currentRowHeight);
    doc.rect(valueLeft, y, valueWidth, currentRowHeight);

    // 라벨 텍스트
    if (row.label.includes('\n')) {
      // 2줄 라벨 (예금주 생년월일/사업자번호)
      const lines = row.label.split('\n');
      const labelImg1 = textToImage(lines[0], 9, 'normal', '#333333', 'center', labelWidth);
      const labelImg2 = textToImage(lines[1], 8, 'normal', '#333333', 'center', labelWidth);
      doc.addImage(labelImg1, 'PNG', tableLeft, y + 1, labelWidth, 6);
      doc.addImage(labelImg2, 'PNG', tableLeft, y + 8, labelWidth, 6);
    } else {
      const labelImg = textToImage(row.label, 10, 'normal', '#333333', 'center', labelWidth);
      doc.addImage(labelImg, 'PNG', tableLeft, y + 1, labelWidth, currentRowHeight - 2);
    }

    // 값 텍스트
    const valueImg = textToImage(row.value, 10, 'normal', '#000000');
    const valueY = row.label.includes('\n') ? y + 3 : y + 1;
    doc.addImage(valueImg, 'PNG', valueLeft + 4, valueY, valueWidth - 8, currentRowHeight - 4);

    y += currentRowHeight;
  }

  // === 전자서명 행 ===
  const signatureRowHeight = 40;

  // 라벨
  doc.setFillColor(245, 245, 245);
  doc.rect(tableLeft, y, labelWidth, signatureRowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(tableLeft, y, labelWidth, signatureRowHeight);

  const signLabelImg = textToImage('전자서명', 10, 'normal', '#333333', 'center', labelWidth);
  doc.addImage(signLabelImg, 'PNG', tableLeft, y + 14, labelWidth, 12);

  // 서명 값 영역
  doc.setFillColor(255, 255, 255);
  doc.rect(valueLeft, y, valueWidth, signatureRowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(valueLeft, y, valueWidth, signatureRowHeight);

  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', valueLeft + 8, y + 4, valueWidth - 16, signatureRowHeight - 8);
    } catch (e) {
      console.warn('Signature image insert failed:', e);
      const noSignImg = textToImage('(서명 삽입 실패)', 9, 'normal', '#999999');
      doc.addImage(noSignImg, 'PNG', valueLeft + 4, y + 14, valueWidth - 8, 12);
    }
  } else {
    const noSignImg = textToImage('(서명 없음)', 9, 'normal', '#999999');
    doc.addImage(noSignImg, 'PNG', valueLeft + 4, y + 14, valueWidth - 8, 12);
  }

  y += signatureRowHeight;

  // === 하단 로고/사명 ===
  y += 12;
  const footerImg = textToImage("D'LIVE  (주)딜라이브 케이블방송", 11, 'bold', '#333333', 'center', tableWidth);
  doc.addImage(footerImg, 'PNG', tableLeft, y, tableWidth, 8);

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
