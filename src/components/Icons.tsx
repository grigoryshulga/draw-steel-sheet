import type { SVGProps } from "react";
import { LockKeyhole } from "lucide-react";
import { Bold, Italic, Strikethrough, Code, SquareCode, Quote, ListOrdered, ListChecks, Link, Image, Table, SeparatorHorizontal, Maximize2, Minimize2, Redo2 } from "lucide-react";
import { Armchair, FileText, Sparkles, Backpack, UserRound, Settings, LogIn, LogOut, Dices, History, Plus, Minus, Trash2, X, ChevronLeft, ChevronDown, ChevronRight, ArrowUp, Cloud, Download, Upload, Copy, Check, Search, Pencil, Sword, Heart, Shield, Zap, Sun, Palette, TriangleAlert, BookText, Library, Users, Tag, RefreshCw, ArrowLeft, ArrowRight, Eye, EyeOff, Save, Play, Pause, Undo2, Archive, Bookmark, ListFilter, List, Ellipsis } from "lucide-react";

export type IconName =
  | "tables"
  | "lock"
  | "bold" | "italic" | "strikethrough" | "code" | "code-block" | "quote"
  | "list-ordered" | "list-check" | "link" | "image" | "table" | "separator"
  | "expand" | "collapse" | "redo"
  | "sheet"
  | "abilities"
  | "inventory"
  | "hero"
  | "settings"
  | "login"
  | "logout"
  | "dice"
  | "history"
  | "plus"
  | "minus"
  | "trash"
  | "close"
  | "chevron-left"
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
  | "shield"
  | "spark"
  | "sun"
  | "palette"
  | "warning"
  | "book"
  | "library"
  | "users"
  | "tag"
  | "refresh"
  | "arrow-right"
  | "arrow-left"
  | "eye"
  | "eye-off"
  | "save"
  | "play"
  | "pause"
  | "undo"
  | "archive"
  | "bookmark"
  | "filter"
  | "list"
  | "more";

const icons = {
  "bold": Bold, "italic": Italic, "strikethrough": Strikethrough,
  "code": Code, "code-block": SquareCode, "quote": Quote,
  "list-ordered": ListOrdered, "list-check": ListChecks, "link": Link,
  "image": Image, "table": Table, "separator": SeparatorHorizontal,
  "expand": Maximize2, "collapse": Minimize2, "redo": Redo2,
  "lock": LockKeyhole,
  "tables": Armchair,
  "sheet": FileText,
  "abilities": Sparkles,
  "inventory": Backpack,
  "hero": UserRound,
  "settings": Settings,
  "login": LogIn,
  "logout": LogOut,
  "dice": Dices,
  "history": History,
  "plus": Plus,
  "minus": Minus,
  "trash": Trash2,
  "close": X,
  "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "arrow-up": ArrowUp,
  "cloud": Cloud,
  "download": Download,
  "upload": Upload,
  "copy": Copy,
  "check": Check,
  "search": Search,
  "edit": Pencil,
  "sword": Sword,
  "heart": Heart,
  "shield": Shield,
  "spark": Zap,
  "sun": Sun,
  "palette": Palette,
  "warning": TriangleAlert,
  "book": BookText,
  "library": Library,
  "users": Users,
  "tag": Tag,
  "refresh": RefreshCw,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "eye": Eye,
  "eye-off": EyeOff,
  "save": Save,
  "play": Play,
  "pause": Pause,
  "undo": Undo2,
  "archive": Archive,
  "bookmark": Bookmark,
  "filter": ListFilter,
  "list": List,
  "more": Ellipsis,
} satisfies Record<IconName, unknown>;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  const Glyph = icons[name];
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" {...props} />;
}
