import React from 'react';
import { Wrench, Users, Package, Settings } from 'lucide-react';
import { View } from '../App';

interface MainMenuProps {
  onSelectMenu: (view: View) => void;
}

const menuItems = [
  { id: 'work-management', title: '작업 관리', description: '작업 처리 및 관리', icon: <Wrench className="h-10 w-10 text-white" /> },
  { id: 'customer-management', title: '고객 관리', description: '고객 정보 조회 및 변경', icon: <Users className="h-10 w-10 text-white" /> },
  { id: 'equipment-management', title: '장비 관리', description: '장비 조회, 할당, 반납 관리', icon: <Package className="h-10 w-10 text-white" /> },
  { id: 'other-management', title: '기타 관리', description: '작업 접수 현황 및 기타 기능', icon: <Settings className="h-10 w-10 text-white" /> },
];

const MainMenu: React.FC<MainMenuProps> = ({ onSelectMenu }) => {
  
  const handleMenuClick = (id: string) => {
    // 각 메뉴별로 해당 화면으로 이동
    switch(id) {
      case 'work-management':
        onSelectMenu('work-management');
        break;
      case 'customer-management':
        onSelectMenu('customer-management');
        break;
      case 'equipment-management':
        onSelectMenu('equipment-management');
        break;
      case 'other-management':
        onSelectMenu('other-management');
        break;
      default:
        onSelectMenu('coming-soon');
    }
  };

  return (
    <div className="px-4 pt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {menuItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleMenuClick(item.id)}
            className="group text-left p-6 bg-white rounded-xl shadow-lg hover:shadow-cyan-500/30 transition-all duration-300 transform hover:-translate-y-1 flex items-center space-x-6"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-lg p-4 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-cyan-500 transition-colors">{item.title}</h3>
              <p className="text-gray-500 mt-1">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MainMenu;