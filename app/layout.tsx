import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "安心看股 · 决策工作台",
  description: "面向 A 股普通投资者的个人变化收件箱、股票研究与交易前决策审查工作台。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><TooltipProvider delay={350}>{children}</TooltipProvider></body></html>;
}
