import re

# Read the file
with open('components/equipment/EquipmentAssignment.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix handleSearch to query all branches when "전체" is selected
old_handle_search = '''  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const params = {
        FROM_OUT_REQ_DT: fromDate,
        TO_OUT_REQ_DT: toDate,
        SO_ID: selectedSoId || userInfo?.soId || '209',  // SO_ID 필수
        PROC_STAT: '%'  // 모든 처리상태 조회 (필수 - 없으면 빈 결과)
      };

      const result = await debugApiCall(
        'EquipmentAssignment',
        'getEquipmentOutList',
        () => getEquipmentOutList(params),
        params
      );
      setEqtOutList(result || []);
      setSelectedEqtOut(null);
      setOutTgtEqtList([]);

      if (result.length === 0) {
        showToast?.('조회된 출고 내역이 없습니다.', 'info');
      } else {
        showToast?.(`${result.length}건의 출고 내역을 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비할당] 조회 실패:', error);
      showToast?.(error.message || '장비할당 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };'''

new_handle_search = '''  const handleSearch = async () => {
    setIsLoading(true);
    try {
      let allResults: EqtOut[] = [];

      // 전체 선택 시 모든 지점 조회
      if (!selectedSoId && soList.length > 0) {
        console.log('[장비할당] 전체 지점 조회 모드 - ', soList.length, '개 지점');
        const promises = soList.map(so => {
          const params = {
            FROM_OUT_REQ_DT: fromDate,
            TO_OUT_REQ_DT: toDate,
            SO_ID: so.SO_ID,
            PROC_STAT: '%'
          };
          return getEquipmentOutList(params).catch(() => []);
        });
        const results = await Promise.all(promises);
        allResults = results.flat();
        console.log('[장비할당] 전체 지점 조회 완료 - 총', allResults.length, '건');
      } else {
        // 특정 지점 선택 시
        const params = {
          FROM_OUT_REQ_DT: fromDate,
          TO_OUT_REQ_DT: toDate,
          SO_ID: selectedSoId || userInfo?.soId || '209',
          PROC_STAT: '%'
        };
        const result = await debugApiCall(
          'EquipmentAssignment',
          'getEquipmentOutList',
          () => getEquipmentOutList(params),
          params
        );
        allResults = result || [];
      }

      // 지점별 정렬 (SO_NM 기준)
      allResults.sort((a, b) => (a.SO_NM || '').localeCompare(b.SO_NM || ''));

      setEqtOutList(allResults);
      setSelectedEqtOut(null);
      setOutTgtEqtList([]);

      if (allResults.length === 0) {
        showToast?.('조회된 출고 내역이 없습니다.', 'info');
      } else {
        showToast?.(`${allResults.length}건의 출고 내역을 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비할당] 조회 실패:', error);
      showToast?.(error.message || '장비할당 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };'''

content = content.replace(old_handle_search, new_handle_search)

# 2. Add grouping logic and update table display with group headers
old_table = '''            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100 whitespace-nowrap">출고일</th>
                      <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">협력업체</th>
                      <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">지점</th>
                      <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100 whitespace-nowrap">출고번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqtOutList.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleEqtOutSelect(item)}
                        className={`cursor-pointer transition-colors ${
                          selectedEqtOut?.OUT_REQ_NO === item.OUT_REQ_NO
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="px-2 py-2.5 text-xs text-center text-gray-900 border-b border-gray-50 whitespace-nowrap">
                          {formatOutDttm(item.OUT_DTTM || item.OUT_REQ_DT)}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-gray-700 border-b border-gray-50 truncate max-w-[80px]">
                          {item.CRR_NM || '-'}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-gray-700 border-b border-gray-50 truncate max-w-[60px]">
                          {item.SO_NM || '-'}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-gray-700 border-b border-gray-50 font-mono whitespace-nowrap">
                          {item.OUT_REQ_NO || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>'''

new_table = '''            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {(() => {
                  // 지점별 그룹핑
                  const grouped = eqtOutList.reduce((acc, item) => {
                    const key = item.SO_NM || '기타';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, EqtOut[]>);
                  const soNames = Object.keys(grouped).sort();

                  return soNames.map((soName) => (
                    <div key={soName}>
                      {/* 지점 헤더 */}
                      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 sticky top-0 z-10">
                        <span className="text-xs font-semibold text-gray-700">{soName}</span>
                        <span className="ml-2 text-xs text-gray-500">({grouped[soName].length}건)</span>
                      </div>
                      {/* 해당 지점의 출고 리스트 */}
                      {grouped[soName].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleEqtOutSelect(item)}
                          className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                            selectedEqtOut?.OUT_REQ_NO === item.OUT_REQ_NO
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : 'hover:bg-blue-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-gray-900 whitespace-nowrap">{formatOutDttm(item.OUT_DTTM || item.OUT_REQ_DT)}</span>
                              <span className="text-gray-600 truncate">{item.CRR_NM || '-'}</span>
                            </div>
                            <span className="text-gray-500 font-mono text-[10px] ml-2 flex-shrink-0">{item.OUT_REQ_NO || '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>'''

content = content.replace(old_table, new_table)

# Write the file
with open('components/equipment/EquipmentAssignment.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("EquipmentAssignment.tsx updated with grouping!")
