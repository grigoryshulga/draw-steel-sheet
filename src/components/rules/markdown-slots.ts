import { Children, isValidElement, type ReactNode } from 'react';

interface SlotProps {
  children?: ReactNode;
  'data-director-slot'?: string;
  'data-range'?: string;
  'data-tier'?: string;
}
export const markdownElements = (children: ReactNode) => Children.toArray(children).filter(isValidElement<SlotProps>);
export const markdownSlot = (children: ReactNode, slot: string) => markdownElements(children).find(child => child.props['data-director-slot'] === slot)?.props.children;
export const markdownText = (children: ReactNode): string => Children.toArray(children).map(child => isValidElement<SlotProps>(child) ? markdownText(child.props.children) : String(child)).join('');
