import './globals.css';
export const metadata = { title: 'IMPOSTER – The Secret Word Game' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><main className="mx-auto max-w-3xl p-4 sm:p-8">{children}</main></body></html>;
}
