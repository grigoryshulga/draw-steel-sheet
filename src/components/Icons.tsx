import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "sheet"
  | "abilities"
  | "inventory"
  | "hero"
  | "settings"
  | "logout"
  | "dice"
  | "history"
  | "plus"
  | "minus"
  | "trash"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "arrow-up"
  | "cloud"
  | "download"
  | "upload"
  | "copy"
  | "check"
  | "search"
  | "edit"
  | "sword"
  | "heart"
  | "spark"
  | "sun"
  | "palette"
  | "warning"
  | "book"
  | "library"
  | "users";

const paths: Record<IconName, ReactNode> = {
  library: <><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1zM12 5v15" /><path d="M5 8h4M5 12h4M15 8h4M15 12h4" /></>,
  sheet: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" />
    </>
  ),
  abilities: (
    <>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
      <path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
    </>
  ),
  inventory: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 016 0v2M9 12v2M15 12v2" />
    </>
  ),
  hero: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21h-4v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3v-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V3h4v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1v4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  history: (
    <>
      <path d="M4.5 12a7.5 7.5 0 107.5-7.5A7.4 7.4 0 006.4 7.1" />
      <path d="M4.5 4v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "arrow-up": <path d="M12 19V5M5 12l7-7 7 7" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 14h10l1-14M9 7V4h6v3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  cloud: (
    <>
      <path d="M7 18a4 4 0 01-.5-8A5.5 5.5 0 0117 9a4.5 4.5 0 01.5 9z" />
      <path d="M12 12v6M9.5 15.5L12 18l2.5-2.5" />
    </>
  ),
  download: <path d="M12 4v11M7.5 11l4.5 4 4.5-4M5 20h14" />,
  upload: <path d="M12 19V8M7.5 12L12 8l4.5 4M5 4h14" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l5 5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l11-11-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  sword: (
    <>
      <path d="M14 4l6-2-2 6-8 8-4-4z" />
      <path d="M6 12l-2 6 6-2M7 17l-3 3" />
    </>
  ),
  heart: <path d="M12 20s-8-4.5-8-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.5-8 10-8 10z" />,
  spark: (
    <>
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <path d="M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 100 18h1.5a2 2 0 001.5-3.3 2 2 0 011.5-3.3H19a2 2 0 002-2A9 9 0 0012 3z" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 9v5M12 17.5v.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a3 3 0 013-3h13v18H7a3 3 0 00-3 3z" />
      <path d="M4 5v16M8 7h8M8 11h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
      <path d="M16 4.5a3.5 3.5 0 010 7M18 20c0-2.5-.8-4.2-2-5.2" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
