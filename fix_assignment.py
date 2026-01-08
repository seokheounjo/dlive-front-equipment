import re

# Read the file
with open('components/equipment/EquipmentAssignment.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change title: "출고 리스트 (파트너사 → 기사)" -> "리스트"
content = content.replace('출고 리스트 (파트너사 → 기사)', '리스트')

# 2. Change table header: "상태" -> "출고번호"
content = content.replace(
    '<th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100">상태</th>',
    '<th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100 whitespace-nowrap">출고번호</th>'
)

# 3. Change status column to show OUT_REQ_NO
old_status_cell = '''<td className="px-3 py-2.5 text-xs text-center border-b border-gray-50">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            item.PROC_STAT === 'C' ? 'bg-green-100 text-green-700' :
                            item.PROC_STAT === 'P' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.PROC_STAT_NM || (item.PROC_STAT === 'C' ? '완료' : item.PROC_STAT === 'P' ? '진행중' : '대기')}
                          </span>
                        </td>'''

new_status_cell = '''<td className="px-2 py-2.5 text-xs text-gray-700 border-b border-gray-50 font-mono whitespace-nowrap">
                          {item.OUT_REQ_NO || '-'}
                        </td>'''

content = content.replace(old_status_cell, new_status_cell)

# 4. Remove "선택된 출고" section
old_selected_section = '''        {/* 선택된 출고 정보 요약 */}
        {selectedEqtOut && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600">📦</span>
              <span className="text-sm font-semibold text-gray-800">선택된 출고</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">출고번호:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.OUT_REQ_NO}</span>
              </div>
              <div>
                <span className="text-gray-500">출고일:</span>
                <span className="ml-1 font-medium">{formatOutDttm(selectedEqtOut.OUT_DTTM || selectedEqtOut.OUT_REQ_DT)}</span>
              </div>
              <div>
                <span className="text-gray-500">협력업체:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.CRR_NM || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">할당기사:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.OUT_REQ_UID_NM || '-'}</span>
              </div>
            </div>
          </div>
        )}'''

content = content.replace(old_selected_section, '')

# 5. Update equipment count to show checked/total format
content = content.replace(
    "{outTgtEqtList.length}개",
    "{outTgtEqtList.filter(i => i.CHK && i.PROC_YN !== 'Y').length}/{outTgtEqtList.length}"
)

# 6. Update checkbox to be disabled for processed items and remove 수량/미처리/상세
old_equipment_card = '''                    {outTgtEqtList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 ${item.CHK ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 체크박스 */}
                          <input
                            type="checkbox"
                            checked={item.CHK || false}
                            onChange={(e) => handleCheckItem(idx, e.target.checked)}
                            className="w-4 h-4 mt-0.5 text-blue-500 rounded focus:ring-blue-500"
                          />

                          {/* 장비 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getItemColor(item.ITEM_MID_CD)}`}>
                                {item.ITEM_MID_CD_NM || item.ITEM_MAX_CD_NM || '장비'}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.EQT_CL_NM || '-'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono">S/N: {item.EQT_SERNO || '-'}</span>
                                {item.MAC_ADDRESS && (
                                  <span className="text-gray-400 font-mono">| MAC: {item.MAC_ADDRESS}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span>수량: {item.OUT_QTY || 1}</span>
                                <span className={`${item.PROC_YN === 'Y' ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {item.PROC_YN === 'Y' ? '✓ 처리완료' : '○ 미처리'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 상세보기 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowDetail(item);
                            }}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            상세
                          </button>
                        </div>
                      </div>
                    ))}'''

new_equipment_card = '''                    {outTgtEqtList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 ${item.PROC_YN === 'Y' ? 'bg-green-50' : item.CHK ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 체크박스 - 처리완료 시 비활성화 및 체크 상태 */}
                          <input
                            type="checkbox"
                            checked={item.PROC_YN === 'Y' ? true : (item.CHK || false)}
                            onChange={(e) => item.PROC_YN !== 'Y' && handleCheckItem(idx, e.target.checked)}
                            disabled={item.PROC_YN === 'Y'}
                            className={`w-4 h-4 mt-0.5 rounded focus:ring-blue-500 ${item.PROC_YN === 'Y' ? 'text-green-500 cursor-not-allowed' : 'text-blue-500'}`}
                          />

                          {/* 장비 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getItemColor(item.ITEM_MID_CD)}`}>
                                {item.ITEM_MID_CD_NM || item.ITEM_MAX_CD_NM || '장비'}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.EQT_CL_NM || '-'}
                              </span>
                              {item.PROC_YN === 'Y' && (
                                <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded font-medium">완료</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              <div className="flex items-center gap-2">
                                <span className="font-mono">S/N: {item.EQT_SERNO || '-'}</span>
                                {item.MAC_ADDRESS && (
                                  <span className="text-gray-400 font-mono">| MAC: {item.MAC_ADDRESS}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}'''

content = content.replace(old_equipment_card, new_equipment_card)

# 7. Move button to fixed position at bottom - update the button section
old_button_section = '''                {/* 입고처리 버튼 */}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCheckAccept}
                    disabled={!outTgtEqtList.some(item => item.CHK)}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 px-6 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    선택 장비 입고처리 ({outTgtEqtList.filter(item => item.CHK).length}건)
                  </button>
                </div>'''

new_button_section = '''                {/* 입고처리 버튼 - 하단 고정 */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3 -mx-0 mt-3">
                  <button
                    onClick={handleCheckAccept}
                    disabled={!outTgtEqtList.some(item => item.CHK && item.PROC_YN !== 'Y')}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 px-6 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    선택 장비 입고처리 ({outTgtEqtList.filter(item => item.CHK && item.PROC_YN !== 'Y').length}건)
                  </button>
                </div>'''

content = content.replace(old_button_section, new_button_section)

# 8. Fix handleCheckAll to exclude processed items
old_check_all = '''  const handleCheckAll = (checked: boolean) => {
    setOutTgtEqtList(outTgtEqtList.map(item => ({ ...item, CHK: checked })));
  };'''

new_check_all = '''  const handleCheckAll = (checked: boolean) => {
    setOutTgtEqtList(outTgtEqtList.map(item => ({
      ...item,
      CHK: item.PROC_YN === 'Y' ? true : checked
    })));
  };'''

content = content.replace(old_check_all, new_check_all)

# 9. Fix "전체 선택" checkbox to only consider unprocessed items
old_check_all_input = '''                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="checkAll"
                      onChange={(e) => handleCheckAll(e.target.checked)}
                      checked={outTgtEqtList.length > 0 && outTgtEqtList.every(item => item.CHK)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="checkAll" className="text-xs text-gray-600 cursor-pointer">전체 선택</label>
                  </div>'''

new_check_all_input = '''                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="checkAll"
                      onChange={(e) => handleCheckAll(e.target.checked)}
                      checked={outTgtEqtList.filter(i => i.PROC_YN !== 'Y').length > 0 && outTgtEqtList.filter(i => i.PROC_YN !== 'Y').every(item => item.CHK)}
                      disabled={outTgtEqtList.every(i => i.PROC_YN === 'Y')}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="checkAll" className="text-xs text-gray-600 cursor-pointer">전체 선택</label>
                  </div>'''

content = content.replace(old_check_all_input, new_check_all_input)

# 10. Fix empty state message
content = content.replace('출고 리스트가 없습니다', '리스트가 없습니다')

# Write the file
with open('components/equipment/EquipmentAssignment.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("EquipmentAssignment.tsx updated successfully!")
