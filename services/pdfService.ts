/**
 * PDF Generation Service
 * 자동이체 납부방법 변경 PDF 생성
 */
import { jsPDF } from 'jspdf';

// 한글 폰트 Base64는 너무 크므로, 기본 폰트 + Unicode escape 방식 대신
// Canvas를 이용한 텍스트 렌더링 방식 사용

interface AutoTransferPdfData {
  // 고객 정보
  custId: string;
  custNm: string;
  pymAcntId: string;

  // 변경 정보
  pymMthNm: string;        // 납부방법명 (자동이체(신))
  changeReasonNm: string;  // 변경사유
  acntHolderNm: string;    // 예금주명
  idTypeNm: string;        // 신분유형명
  birthDt: string;         // 생년월일
  bankNm: string;          // 은행명
  acntNo: string;          // 계좌번호
  pyrRelNm: string;        // 납부자관계명

  // 서명 이미지 (base64)
  signatureData?: string;

  // 생성일시
  createdAt?: string;
}

/**
 * Canvas를 이용하여 한글 텍스트를 이미지로 변환 후 PDF에 삽입하는 방식으로 PDF 생성
 */
export async function generateAutoTransferPdf(data: AutoTransferPdfData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Canvas 기반 한글 텍스트 → 이미지 변환
  const textToImage = (
    text: string,
    fontSize: number = 12,
    fontWeight: string = 'normal',
    color: string = '#000000',
    maxWidth: number = contentWidth * 3 // mm to px approximate
  ): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const scale = 3; // 고해상도
    const font = `${fontWeight} ${fontSize * scale}px "Malgun Gothic", "맑은 고딕", sans-serif`;
    ctx.font = font;

    const metrics = ctx.measureText(text);
    canvas.width = Math.min(Math.ceil(metrics.width) + 10, maxWidth * scale);
    canvas.height = Math.ceil(fontSize * scale * 1.5);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  };

  // 텍스트를 PDF에 이미지로 추가하는 헬퍼
  const addText = (
    text: string,
    x: number,
    y: number,
    fontSize: number = 10,
    fontWeight: string = 'normal',
    color: string = '#333333'
  ): number => {
    const img = textToImage(text, fontSize, fontWeight, color);
    const imgHeight = fontSize * 0.5; // mm
    const imgWidth = contentWidth; // 최대 너비
    doc.addImage(img, 'PNG', x, y, imgWidth, imgHeight);
    return y + imgHeight + 1;
  };

  // 라벨-값 행 추가
  const addRow = (label: string, value: string, y: number): number => {
    const labelImg = textToImage(label, 10, 'bold', '#555555');
    const valueImg = textToImage(value || '-', 10, 'normal', '#000000');
    const rowH = 6;

    doc.addImage(labelImg, 'PNG', margin, y, 35, rowH - 1);
    doc.addImage(valueImg, 'PNG', margin + 38, y, contentWidth - 40, rowH - 1);

    // 하단 구분선
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

    return y + rowH + 1;
  };

  let y = margin;

  // === 제목 ===
  const titleImg = textToImage('자동이체 납부방법 변경 신청서', 16, 'bold', '#1a1a1a');
  doc.addImage(titleImg, 'PNG', margin, y, contentWidth, 8);
  y += 12;

  // 구분선
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  // === 고객 정보 섹션 ===
  const sectionImg1 = textToImage('고객 정보', 12, 'bold', '#2563eb');
  doc.addImage(sectionImg1, 'PNG', margin, y, 40, 5);
  y += 8;

  y = addRow('고객ID', data.custId, y);
  y = addRow('고객명', data.custNm, y);
  y = addRow('납부계정ID', data.pymAcntId, y);
  y += 4;

  // === 변경 정보 섹션 ===
  const sectionImg2 = textToImage('변경 정보', 12, 'bold', '#2563eb');
  doc.addImage(sectionImg2, 'PNG', margin, y, 40, 5);
  y += 8;

  y = addRow('납부방법', data.pymMthNm, y);
  y = addRow('변경사유', data.changeReasonNm, y);
  y = addRow('예금주명', data.acntHolderNm, y);
  y = addRow('신분유형', data.idTypeNm, y);
  y = addRow('생년월일', data.birthDt, y);
  y = addRow('은행명', data.bankNm, y);
  y = addRow('계좌번호', maskAccountNo(data.acntNo), y);
  y = addRow('납부자관계', data.pyrRelNm, y);
  y += 4;

  // === 서명 섹션 ===
  const sectionImg3 = textToImage('고객 서명', 12, 'bold', '#2563eb');
  doc.addImage(sectionImg3, 'PNG', margin, y, 40, 5);
  y += 8;

  if (data.signatureData) {
    // 서명 이미지 테두리
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, 60, 25);

    try {
      doc.addImage(data.signatureData, 'PNG', margin + 2, y + 2, 56, 21);
    } catch (e) {
      console.warn('Signature image insert failed:', e);
    }
    y += 28;
  } else {
    y = addRow('서명', '(서명 없음)', y);
  }

  y += 6;

  // === 하단 정보 ===
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  const dateStr = data.createdAt || new Date().toLocaleString('ko-KR');
  const dateImg = textToImage(`생성일시: ${dateStr}`, 8, 'normal', '#999999');
  doc.addImage(dateImg, 'PNG', margin, y, contentWidth, 3);
  y += 5;

  const footerImg = textToImage('본 문서는 D\'Live 모바일 고객관리 시스템에서 자동 생성되었습니다.', 8, 'normal', '#999999');
  doc.addImage(footerImg, 'PNG', margin, y, contentWidth, 3);

  return doc.output('blob');
}

// 계좌번호 마스킹 (중간 자리 **)
function maskAccountNo(acntNo: string): string {
  if (!acntNo || acntNo.length < 6) return acntNo;
  const first3 = acntNo.slice(0, 3);
  const last3 = acntNo.slice(-3);
  const middle = '*'.repeat(acntNo.length - 6);
  return first3 + middle + last3;
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
