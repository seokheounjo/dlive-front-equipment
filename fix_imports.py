#!/usr/bin/env python3
"""
Import 경로 자동 수정 스크립트
"""

import os
import re
from pathlib import Path

# 컴포넌트 분류
COMPONENT_MAP = {
    # work
    'Dashboard': 'work',
    'TodayWork': 'work',
    'WorkOrderDetail': 'work',
    'WorkCompleteForm': 'work',
    'WorkCompleteDetail': 'work',
    'WorkProcessFlow': 'work',
    'WorkItemList': 'work',
    'WorkDirectionRow': 'work',
    'WorkOrderCard': 'work',
    'WorkCancelModal': 'work',
    'WorkResultSignalList': 'work',
    'ASWorkDetails': 'work',
    'InstallWorkDetails': 'work',
    'TerminationWorkDetails': 'work',
    'SuspensionWorkDetails': 'work',
    'RelocationWorkDetails': 'work',
    'ProductChangeWorkDetails': 'work',
    'ReceptionInfo': 'work',
    'ContractInfo': 'work',
    'SafetyCheckList': 'work',
    'SafetyCheckModal': 'work',
    'WorkItemCard': 'work',

    # equipment
    'EquipmentManagement': 'equipment',
    'EquipmentManagementMenu': 'equipment',
    'EquipmentModelChangeModal': 'equipment',
    'EquipmentInstallation': 'equipment',
    'EquipmentAssignment': 'equipment',
    'EquipmentMovement': 'equipment',
    'EquipmentRecovery': 'equipment',
    'EquipmentStatusView': 'equipment',
    'SignalCheck': 'equipment',
    'SignalHistoryList': 'equipment',

    # customer
    'CustomerManagement': 'customer',
    'CustomerInfo': 'customer',
    'CustomerInfoManagement': 'customer',

    # common
    'Header': 'common',
    'BottomNavigation': 'common',
    'SideDrawer': 'common',
    'Toast': 'common',
    'ErrorBoundary': 'common',
    'ErrorMessage': 'common',
    'LoadingSpinner': 'common',
    'BaseModal': 'common',
    'VipBadge': 'common',
    'VipCounter': 'common',
    'DliveLogo': 'common',

    # layout
    'MainMenu': 'layout',
    'ComingSoon': 'layout',
    'Login': 'layout',
    'ScrollableTabMenu': 'layout',
    'SlidingTabMenu': 'layout',

    # other
    'OtherManagement': 'other',
    'AutomationBot': 'other',
    'LGUConstructionRequest': 'other',
    'LGUNetworkFault': 'other',
    'WorkerAdjustment': 'other',

    # modal
    'InstallInfoModal': 'modal',
    'IntegrationHistoryModal': 'modal',
}

def fix_imports_in_file(file_path):
    """파일의 import 경로를 수정합니다."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 각 컴포넌트에 대해 import 경로 수정
    for component, folder in COMPONENT_MAP.items():
        # from './ComponentName' → from '../folder/ComponentName'
        pattern = rf"from '\./({component})';"
        replacement = rf"from '../{folder}/\1';"
        content = re.sub(pattern, replacement, content)

        # from "./ComponentName" → from "../folder/ComponentName"
        pattern = rf'from "\./({component})";'
        replacement = rf'from "../{folder}/\1";'
        content = re.sub(pattern, replacement, content)

    # 변경사항이 있으면 파일 저장
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ {file_path}")
        return True
    return False

def main():
    """모든 tsx 파일의 import 경로를 수정합니다."""
    components_dir = Path('components')
    fixed_count = 0

    # 모든 tsx 파일 찾기
    for tsx_file in components_dir.rglob('*.tsx'):
        if fix_imports_in_file(tsx_file):
            fixed_count += 1

    print(f"\n✅ {fixed_count}개 파일의 import 경로 수정 완료!")

if __name__ == '__main__':
    main()
