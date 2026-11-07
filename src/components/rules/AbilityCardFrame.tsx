import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, type CardProps } from '../ui/Card';
import '../AbilityCard.css';

/** Shared shell for calculated hero abilities and source-only monster cards. */
export function AbilityCardFrame({
  title, titleText, tags, actionType, kind, full = false, flat = false,
  className = '', children, onOpen, ...props
}: Omit<CardProps, 'title'> & {
  title: ReactNode;
  titleText?: string;
  tags?: ReactNode;
  actionType: string;
  kind?: string;
  full?: boolean;
  flat?: boolean;
}) {
  return <Card {...props}
    className={`sheet-ability-card${full ? ' is-full' : ''}${flat ? ' is-flat' : ''}${className ? ` ${className}` : ''}`}
    data-action={actionType} data-kind={kind} onOpen={onOpen} keyboardTarget="title">
    <CardHeader className="sheet-ability-card-head card-band">
      <CardTitle as="h4" title={titleText} onOpen={onOpen}
        openLabel={`Открыть способность: ${titleText || 'без названия'}`}>
        {title}
      </CardTitle>
      {tags}
    </CardHeader>
    {children}
  </Card>;
}
