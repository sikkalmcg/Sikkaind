import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Module Selection',
};

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
