import { createFileRoute } from "@tanstack/react-router";
import { Settings, Key, Webhook, Database, Save, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/_layout/settings")({
  head: () => ({ meta: [{ title: "PalNet Admin — Settings" }] }),
  component: AdminSettings,
});

function Section({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-card p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <Icon className="size-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SecretInput({ label, placeholder, envVar }: { label: string; placeholder: string; envVar: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="admin-label">{label}</Label>
        <code className="text-xs text-cyan-400/70">{envVar}</code>
      </div>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className="admin-input pr-9"
        />
        <button
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

function AdminSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="size-5 text-cyan-400" />
          Settings & System Config
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          API keys, webhook endpoints, and Supabase backend configuration.
          Changes here require a server restart to take effect.
        </p>
      </div>

      <Section icon={Database} title="Supabase Backend" sub="Database and authentication credentials">
        <SecretInput label="Supabase Project URL" placeholder="https://xxxx.supabase.co" envVar="SUPABASE_URL" />
        <SecretInput label="Supabase Anon Key" placeholder="eyJhbGci…" envVar="SUPABASE_ANON_KEY" />
        <SecretInput label="Supabase Service Role Key" placeholder="eyJhbGci…" envVar="SUPABASE_SERVICE_ROLE_KEY" />
      </Section>

      <Section icon={Key} title="Safaricom Daraja API" sub="M-Pesa STK Push credentials">
        <SecretInput label="Consumer Key" placeholder="Daraja consumer key" envVar="MPESA_CONSUMER_KEY" />
        <SecretInput label="Consumer Secret" placeholder="Daraja consumer secret" envVar="MPESA_CONSUMER_SECRET" />
        <SecretInput label="Passkey" placeholder="Lipa Na M-Pesa passkey" envVar="MPESA_PASSKEY" />
        <div className="space-y-1.5">
          <Label className="admin-label">Shortcode / Till Number</Label>
          <Input placeholder="e.g. 174379" className="admin-input" />
        </div>
        <div className="space-y-1.5">
          <Label className="admin-label">Callback URL</Label>
          <Input placeholder="https://palnet-wifi.vercel.app/api/public/mpesa/callback" className="admin-input" />
        </div>
      </Section>

      <Section icon={Webhook} title="Router API Credentials" sub="MikroTik / OpenWrt REST API access">
        <SecretInput label="Router API Username" placeholder="admin" envVar="ROUTER_API_USER" />
        <SecretInput label="Router API Password" placeholder="router password" envVar="ROUTER_API_PASSWORD" />
        <div className="space-y-1.5">
          <Label className="admin-label">Default API Port</Label>
          <Input type="number" placeholder="8728" className="admin-input" />
        </div>
      </Section>

      <div className="flex gap-3 pt-2">
        <Button className="admin-btn-primary gap-2">
          <Save className="size-4" /> Save Changes
        </Button>
        <p className="self-center text-xs text-slate-500">
          These values are stored as environment variables on the server — they are never exposed to the browser.
        </p>
      </div>
    </div>
  );
}
