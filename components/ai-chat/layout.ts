export type MobileLayout = 'fullscreen' | 'panel';

// Build-time public flag: only the trimmed 'panel' value enables the panel.
export function resolveMobileLayout(value: string | undefined): MobileLayout {
  return value?.trim() === 'panel' ? 'panel' : 'fullscreen';
}
