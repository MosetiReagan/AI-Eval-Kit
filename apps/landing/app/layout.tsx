import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Eval Kit — Local-First Evaluation Suite for LLMs',
  description: 'Run automated unit and regression tests on LLM outputs, tool calls, and agent trajectories directly from your terminal and CI/CD pipelines without sending data to third-party SaaS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-slate-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
