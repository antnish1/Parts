import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type AppIconName =
  | 'activity'
  | 'alert'
  | 'chart'
  | 'check'
  | 'chevronRight'
  | 'clock'
  | 'grid'
  | 'home'
  | 'inbox'
  | 'inventory'
  | 'more'
  | 'package'
  | 'refresh'
  | 'search'
  | 'shield'
  | 'truck'
  | 'wallet'
  | 'work'
  | 'x';

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function AppIcon({ name, size = 20, color = colors.navy, strokeWidth = 1.9 }: Props) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' ? <><Circle cx="11" cy="11" r="7" {...common} /><Line x1="16.3" y1="16.3" x2="21" y2="21" {...common} /></> : null}
      {name === 'clock' ? <><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 7v5l3.5 2" {...common} /></> : null}
      {name === 'alert' ? <><Path d="M10.2 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.8 4.2a2 2 0 0 0-3.6 0Z" {...common} /><Line x1="12" y1="9" x2="12" y2="13" {...common} /><Circle cx="12" cy="17" r=".7" fill={color} /></> : null}
      {name === 'check' ? <Polyline points="4,12 9,17 20,6" {...common} /> : null}
      {name === 'x' ? <><Line x1="5" y1="5" x2="19" y2="19" {...common} /><Line x1="19" y1="5" x2="5" y2="19" {...common} /></> : null}
      {name === 'refresh' ? <><Path d="M20 11a8 8 0 0 0-14.8-4L3 10" {...common} /><Polyline points="3,5 3,10 8,10" {...common} /><Path d="M4 13a8 8 0 0 0 14.8 4L21 14" {...common} /><Polyline points="16,14 21,14 21,19" {...common} /></> : null}
      {name === 'package' ? <><Path d="m3 7 9-4 9 4-9 4-9-4Z" {...common} /><Path d="M3 7v10l9 4 9-4V7" {...common} /><Path d="M12 11v10" {...common} /></> : null}
      {name === 'truck' ? <><Rect x="2" y="6" width="12" height="10" rx="1" {...common} /><Path d="M14 9h4l4 4v3h-8V9Z" {...common} /><Circle cx="7" cy="18" r="2" {...common} /><Circle cx="18" cy="18" r="2" {...common} /></> : null}
      {name === 'inbox' ? <><Path d="M4 5h16l2 8v6H2v-6l2-8Z" {...common} /><Path d="M2 13h5l2 3h6l2-3h5" {...common} /></> : null}
      {name === 'chevronRight' ? <Polyline points="9,5 16,12 9,19" {...common} /> : null}
      {name === 'home' ? <><Path d="m3 10 9-7 9 7" {...common} /><Path d="M5 9v11h14V9" {...common} /><Path d="M9 20v-6h6v6" {...common} /></> : null}
      {name === 'work' ? <><Rect x="3" y="7" width="18" height="13" rx="2" {...common} /><Path d="M9 7V4h6v3" {...common} /><Path d="M3 12h18" {...common} /><Path d="M10 12v2h4v-2" {...common} /></> : null}
      {name === 'activity' ? <Polyline points="3,12 7,12 9,6 13,18 16,10 18,12 21,12" {...common} /> : null}
      {name === 'more' ? <><Circle cx="5" cy="12" r="1.2" fill={color} /><Circle cx="12" cy="12" r="1.2" fill={color} /><Circle cx="19" cy="12" r="1.2" fill={color} /></> : null}
      {name === 'grid' ? <><Rect x="3" y="3" width="7" height="7" rx="1.5" {...common} /><Rect x="14" y="3" width="7" height="7" rx="1.5" {...common} /><Rect x="3" y="14" width="7" height="7" rx="1.5" {...common} /><Rect x="14" y="14" width="7" height="7" rx="1.5" {...common} /></> : null}
      {name === 'chart' ? <><Path d="M4 19V9" {...common} /><Path d="M10 19V5" {...common} /><Path d="M16 19v-7" {...common} /><Path d="M22 19V3" {...common} /></> : null}
      {name === 'inventory' ? <><Rect x="3" y="4" width="18" height="16" rx="2" {...common} /><Line x1="3" y1="9" x2="21" y2="9" {...common} /><Line x1="9" y1="9" x2="9" y2="20" {...common} /><Line x1="15" y1="9" x2="15" y2="20" {...common} /></> : null}
      {name === 'shield' ? <><Path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z" {...common} /><Polyline points="8.5,12 11,14.5 16,9.5" {...common} /></> : null}
      {name === 'wallet' ? <><Rect x="3" y="6" width="18" height="14" rx="2" {...common} /><Path d="M3 9h18" {...common} /><Path d="M15 13h6v4h-6a2 2 0 0 1 0-4Z" {...common} /></> : null}
    </Svg>
  );
}
