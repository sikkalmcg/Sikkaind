import { redirect } from 'next/navigation';

const TCODE_TO_PATH: Record<string, string> = {
  MK01: '/dashboard/mk01',
  MK02: '/dashboard/mk02',
  MK03: '/dashboard/mk03',
};

export default function DashboardMk({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const rawTcode = searchParams?.tcode;
  const tcode = Array.isArray(rawTcode) ? rawTcode[0] : rawTcode;

  const target = tcode ? TCODE_TO_PATH[tcode.toUpperCase()] : undefined;

  if (!target) {
    redirect('/dashboard');
  }

  redirect(target);
}

