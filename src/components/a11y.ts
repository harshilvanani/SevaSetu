import { Platform } from 'react-native';

// Hide decorative elements (icons, illustrations) from screen readers on every platform.
export const decorative = Platform.select<object>({
  web: { 'aria-hidden': true },
  default: { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' },
});
