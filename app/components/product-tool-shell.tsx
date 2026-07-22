"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Bot,
  FileSearch,
  LayoutDashboard,
  Layers3,
  MessageSquareWarning,
  ScanSearch,
  ReceiptText,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

type ProductToolShellProps = {
  active: "etf" | "trade" | "quant" | "agent";
  title: string;
  description: string;
  status: string;
  children: React.ReactNode;
};

const navigation: Array<{ href: string; label: string; icon: typeof LayoutDashboard; id?: ProductToolShellProps["active"] }> = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/opportunity", label: "机会检查", icon: MessageSquareWarning },
  { href: "/agent", label: "任务助手", icon: Bot, id: "agent" },
  { href: "/profile", label: "我的规则", icon: SlidersHorizontal },
  { href: "/portfolio", label: "我的组合", icon: BriefcaseBusiness },
  { href: "/analysis?view=research", label: "股票研究", icon: FileSearch },
  { href: "/etf-tool", label: "ETF 诊断", icon: Layers3, id: "etf" },
  { href: "/quant", label: "量化研究", icon: ScanSearch, id: "quant" },
  { href: "/trade-tool", label: "交易复盘", icon: ReceiptText, id: "trade" },
  { href: "/ai-settings", label: "AI 模型", icon: Sparkles },
];

export function ProductToolShell({ active, title, description, status, children }: ProductToolShellProps) {
  return (
    <div className="native-tool-shell">
      <a className="skip-link" href="#tool-main">跳到主要内容</a>
      <aside className="native-tool-rail">
        <Link className="native-tool-brand" href="/" aria-label="安心看股工作台"><span>安</span><strong>安心看股</strong></Link>
        <nav aria-label="主导航">
          {navigation.map(({ href, label, icon: Icon, id }) => {
            const selected = id === active;
            return <Link key={label} href={href} className={selected ? "native-tool-nav active" : "native-tool-nav"} aria-current={selected ? "page" : undefined}><Icon /><span>{label}</span></Link>;
          })}
        </nav>
      </aside>
      <header className="native-tool-header">
        <div><h1>{title}</h1><p>{description}</p></div>
        <span className="native-data-status"><i />{status}</span>
      </header>
      <main id="tool-main" className="native-tool-main">{children}</main>
    </div>
  );
}
