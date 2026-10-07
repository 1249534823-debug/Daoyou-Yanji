import type { SVGProps } from 'react';

const paths = {
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75',
  message:
    'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5M8 11h8',
  game: 'M8 3h8l1 4 4 1v8l-4 1-1 4H8l-1-4-4-1V8l4-1 1-4m4 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8z',
  monitor: 'M3 3v18h18M7 16v-5m5 5V7m5 9v-8',
  chevron: 'm8 10 4 4 4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  back: 'm9 5-7 7 7 7M2 12h13a5 5 0 0 1 5 5',
  refresh:
    'M20 7v5h-5M4 17v-5h5M6.1 6.1a8 8 0 0 1 13.3 3.4M4.6 14.5a8 8 0 0 0 13.3 3.4',
} as const;

export type AdminIconName = keyof typeof paths;

export function AdminIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: AdminIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
