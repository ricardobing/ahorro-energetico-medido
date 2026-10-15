import type { ReactNode, SVGProps } from 'react';

/** Íconos de trazo de 1,8 px dibujados para el proyecto (sin librería). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const IconStep = (p: P) => (
  <Icon {...p}>
    <path d="M5 19V9l7-5 7 5v10" />
    <path d="M10 19v-5h4v5" />
  </Icon>
);
export const IconPlan = (p: P) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h7" />
    <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18h1" />
  </Icon>
);
export const IconBill = (p: P) => (
  <Icon {...p}>
    <path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z" />
    <path d="M10 8h4M10 12h4" />
  </Icon>
);
export const IconBills = (p: P) => (
  <Icon {...p}>
    <path d="M8 3h11v14H8z" />
    <path d="M5 7v14h11" />
    <path d="M11 8h5M11 12h5" />
  </Icon>
);
export const IconSavings = (p: P) => (
  <Icon {...p}>
    <path d="M4 18l5-6 4 3 7-9" />
    <path d="M15 6h5v5" />
  </Icon>
);
export const IconMore = (p: P) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18" cy="12" r="1.2" />
  </Icon>
);
export const IconReport = (p: P) => (
  <Icon {...p}>
    <path d="M6 3h9l3 3v15H6z" />
    <path d="M9 17v-3M12 17v-6M15 17v-4" />
  </Icon>
);
export const IconPartners = (p: P) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
  </Icon>
);
export const IconBell = (p: P) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);
export const IconProfile = (p: P) => (
  <Icon {...p}>
    <path d="M4 20V9l8-5 8 5v11z" />
    <path d="M9 20v-6h6v6" />
  </Icon>
);
export const IconDemo = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </Icon>
);
export const IconCheck = (p: P) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
);
export const IconInfo = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </Icon>
);
export const IconAlert = (p: P) => (
  <Icon {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4M12 17v.5" />
  </Icon>
);
export const IconClose = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconChevron = (p: P) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
export const IconChevronDown = (p: P) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const IconCamera = (p: P) => (
  <Icon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
export const IconSpark = (p: P) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </Icon>
);
export const IconPrint = (p: P) => (
  <Icon {...p}>
    <path d="M7 9V3h10v6" />
    <path d="M7 17H4v-8h16v8h-3" />
    <path d="M7 14h10v7H7z" />
  </Icon>
);
