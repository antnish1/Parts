import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type AppIconName =
  | 'alert'
  | 'check'
  | 'chevronRight'
  | 'clock'
  | 'inbox'
  | 'package'
  | 'refresh'
  | 'search'
  | 'truck'
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
    </Svg>
  );
}
