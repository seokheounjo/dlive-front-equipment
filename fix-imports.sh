#!/bin/bash

# Import 경로 자동 수정 스크립트

cd "$(dirname "$0")/components"

# 모든 폴더의 tsx 파일에서 import 경로 수정
find . -name "*.tsx" -type f | while read file; do
  # work 폴더 컴포넌트들
  sed -i '' "s|from './Dashboard'|from '../work/Dashboard'|g" "$file"
  sed -i '' "s|from './TodayWork'|from '../work/TodayWork'|g" "$file"
  sed -i '' "s|from './WorkOrderDetail'|from '../work/WorkOrderDetail'|g" "$file"
  sed -i '' "s|from './WorkCompleteForm'|from '../work/WorkCompleteForm'|g" "$file"
  sed -i '' "s|from './WorkCompleteDetail'|from '../work/WorkCompleteDetail'|g" "$file"
  sed -i '' "s|from './WorkProcessFlow'|from '../work/WorkProcessFlow'|g" "$file"
  sed -i '' "s|from './WorkItemList'|from '../work/WorkItemList'|g" "$file"
  sed -i '' "s|from './WorkDirectionRow'|from '../work/WorkDirectionRow'|g" "$file"
  sed -i '' "s|from './WorkOrderCard'|from '../work/WorkOrderCard'|g" "$file"
  sed -i '' "s|from './WorkCancelModal'|from '../work/WorkCancelModal'|g" "$file"
  sed -i '' "s|from './WorkResultSignalList'|from '../work/WorkResultSignalList'|g" "$file"
  sed -i '' "s|from './ASWorkDetails'|from '../work/ASWorkDetails'|g" "$file"
  sed -i '' "s|from './InstallWorkDetails'|from '../work/InstallWorkDetails'|g" "$file"
  sed -i '' "s|from './TerminationWorkDetails'|from '../work/TerminationWorkDetails'|g" "$file"
  sed -i '' "s|from './SuspensionWorkDetails'|from '../work/SuspensionWorkDetails'|g" "$file"
  sed -i '' "s|from './RelocationWorkDetails'|from '../work/RelocationWorkDetails'|g" "$file"
  sed -i '' "s|from './ProductChangeWorkDetails'|from '../work/ProductChangeWorkDetails'|g" "$file"
  sed -i '' "s|from './ReceptionInfo'|from '../work/ReceptionInfo'|g" "$file"
  sed -i '' "s|from './ContractInfo'|from '../work/ContractInfo'|g" "$file"
  sed -i '' "s|from './SafetyCheckList'|from '../work/SafetyCheckList'|g" "$file"
  sed -i '' "s|from './SafetyCheckModal'|from '../work/SafetyCheckModal'|g" "$file"
  sed -i '' "s|from './WorkItemCard'|from '../work/WorkItemCard'|g" "$file"

  # equipment 폴더 컴포넌트들
  sed -i '' "s|from './EquipmentManagement'|from '../equipment/EquipmentManagement'|g" "$file"
  sed -i '' "s|from './EquipmentManagementMenu'|from '../equipment/EquipmentManagementMenu'|g" "$file"
  sed -i '' "s|from './EquipmentModelChangeModal'|from '../equipment/EquipmentModelChangeModal'|g" "$file"
  sed -i '' "s|from './EquipmentInstallation'|from '../equipment/EquipmentInstallation'|g" "$file"
  sed -i '' "s|from './EquipmentAssignment'|from '../equipment/EquipmentAssignment'|g" "$file"
  sed -i '' "s|from './EquipmentMovement'|from '../equipment/EquipmentMovement'|g" "$file"
  sed -i '' "s|from './EquipmentRecovery'|from '../equipment/EquipmentRecovery'|g" "$file"
  sed -i '' "s|from './EquipmentStatusView'|from '../equipment/EquipmentStatusView'|g" "$file"
  sed -i '' "s|from './SignalCheck'|from '../equipment/SignalCheck'|g" "$file"
  sed -i '' "s|from './SignalHistoryList'|from '../equipment/SignalHistoryList'|g" "$file"

  # customer 폴더 컴포넌트들
  sed -i '' "s|from './CustomerManagement'|from '../customer/CustomerManagement'|g" "$file"
  sed -i '' "s|from './CustomerInfo'|from '../customer/CustomerInfo'|g" "$file"
  sed -i '' "s|from './CustomerInfoManagement'|from '../customer/CustomerInfoManagement'|g" "$file"

  # common 폴더 컴포넌트들
  sed -i '' "s|from './Header'|from '../common/Header'|g" "$file"
  sed -i '' "s|from './BottomNavigation'|from '../common/BottomNavigation'|g" "$file"
  sed -i '' "s|from './SideDrawer'|from '../common/SideDrawer'|g" "$file"
  sed -i '' "s|from './Toast'|from '../common/Toast'|g" "$file"
  sed -i '' "s|from './ErrorBoundary'|from '../common/ErrorBoundary'|g" "$file"
  sed -i '' "s|from './ErrorMessage'|from '../common/ErrorMessage'|g" "$file"
  sed -i '' "s|from './LoadingSpinner'|from '../common/LoadingSpinner'|g" "$file"
  sed -i '' "s|from './BaseModal'|from '../common/BaseModal'|g" "$file"
  sed -i '' "s|from './VipBadge'|from '../common/VipBadge'|g" "$file"
  sed -i '' "s|from './VipCounter'|from '../common/VipCounter'|g" "$file"
  sed -i '' "s|from './DliveLogo'|from '../common/DliveLogo'|g" "$file"

  # layout 폴더 컴포넌트들
  sed -i '' "s|from './MainMenu'|from '../layout/MainMenu'|g" "$file"
  sed -i '' "s|from './ComingSoon'|from '../layout/ComingSoon'|g" "$file"
  sed -i '' "s|from './Login'|from '../layout/Login'|g" "$file"
  sed -i '' "s|from './ScrollableTabMenu'|from '../layout/ScrollableTabMenu'|g" "$file"
  sed -i '' "s|from './SlidingTabMenu'|from '../layout/SlidingTabMenu'|g" "$file"

  # other 폴더 컴포넌트들
  sed -i '' "s|from './OtherManagement'|from '../other/OtherManagement'|g" "$file"
  sed -i '' "s|from './AutomationBot'|from '../other/AutomationBot'|g" "$file"
  sed -i '' "s|from './LGUConstructionRequest'|from '../other/LGUConstructionRequest'|g" "$file"
  sed -i '' "s|from './LGUNetworkFault'|from '../other/LGUNetworkFault'|g" "$file"
  sed -i '' "s|from './WorkerAdjustment'|from '../other/WorkerAdjustment'|g" "$file"

  # modal 폴더 컴포넌트들
  sed -i '' "s|from './InstallInfoModal'|from '../modal/InstallInfoModal'|g" "$file"
  sed -i '' "s|from './IntegrationHistoryModal'|from '../modal/IntegrationHistoryModal'|g" "$file"
done

echo "Import 경로 자동 수정 완료!"
