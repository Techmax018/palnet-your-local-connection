export type DeviceRegistration = {
  token: string;
  site_identity: string;
  device_id: string;
  serial_number: string;
  model: string;
  mac_address: string;
  routeros_version: string;
  board_name: string;
};

export type BootstrapScriptOptions = {
  siteIdentity: string;
  token: string;
  heartbeatKey: string;
  configVersion?: string;
  apiBaseUrl?: string;
};

export function resolveProvisionApiBaseUrl(input?: string): string {
  const override = (input ?? process.env["APP_URL"] ?? process.env["PUBLIC_APP_URL"] ?? process.env["SITE_URL"] ?? "").trim();
  if (override) {
    return override.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://palnet-wifi.lovable.app";
}

function normalizeSiteIdentity(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9 _-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "PalNet-Site";
}

export function rosEscape(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "");
}

export function createProvisionToken(siteIdentity: string): string {
  const normalized = normalizeSiteIdentity(siteIdentity).toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
  const suffix = (crypto.randomUUID() ?? "prov").replace(/-/g, "").slice(0, 16);
  return `prov_${slug}_${suffix}`;
}

export function validateProvisionToken(
  token: string,
  expiresAtIso: string,
): { ok: boolean; siteIdentity?: string; message?: string } {
  if (!/^prov_[a-z0-9_-]+$/i.test(token)) {
    return { ok: false, message: "Invalid token format" };
  }

  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) {
    return { ok: false, message: "Invalid token expiry" };
  }

  if (expiresAt.getTime() <= Date.now()) {
    return { ok: false, message: "Token expired" };
  }

  const raw = token.replace(/^prov_/i, "");
  const parts = raw.split("_").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, message: "Token missing site identity" };
  }

  const siteIdentity = parts.slice(0, -1).join("-") || "PalNet-Site";
  return { ok: true, siteIdentity: siteIdentity.replace(/-+/g, "-") };
}

export function parseDeviceRegistration(input: unknown):
  | { ok: true; data: DeviceRegistration }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Request body is required" };
  }

  const record = input as Record<string, unknown>;
  const token = String(record["token"] ?? "").trim();
  const siteIdentity = String(record["site_identity"] ?? "").trim();
  const deviceId = String(record["device_id"] ?? "").trim();
  const serialNumber = String(record["serial_number"] ?? "").trim();
  const model = String(record["model"] ?? "").trim();
  const macAddress = String(record["mac_address"] ?? "").trim();
  const routerOsVersion = String(record["routeros_version"] ?? "").trim();
  const boardName = String(record["board_name"] ?? "").trim();

  if (!token || !/^prov_[a-z0-9_-]+$/i.test(token)) {
    return { ok: false, message: "Invalid token format" };
  }

  if (!siteIdentity || siteIdentity.length > 64) {
    return { ok: false, message: "site_identity is required and must be under 64 chars" };
  }

  if (!deviceId || deviceId.length > 128) {
    return { ok: false, message: "device_id is required and must be under 128 chars" };
  }

  if (!serialNumber || serialNumber.length > 128) {
    return { ok: false, message: "serial_number is required and must be under 128 chars" };
  }

  if (!model || model.length > 128) {
    return { ok: false, message: "model is required and must be under 128 chars" };
  }

  if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/.test(macAddress)) {
    return { ok: false, message: "MAC address is invalid" };
  }

  if (!routerOsVersion || routerOsVersion.length > 32) {
    return { ok: false, message: "routeros_version is required and must be under 32 chars" };
  }

  if (!boardName || boardName.length > 128) {
    return { ok: false, message: "board_name is required and must be under 128 chars" };
  }

  return {
    ok: true,
    data: {
      token,
      site_identity: normalizeSiteIdentity(siteIdentity),
      device_id: deviceId,
      serial_number: serialNumber,
      model,
      mac_address: macAddress,
      routeros_version: routerOsVersion,
      board_name: boardName,
    },
  };
}

export type NetworkOverrides = {
  wan?: string | undefined;
  lanBridge?: string | undefined;
  lanPorts?: string[] | undefined;
  gateway?: string | undefined; // CIDR, e.g. 10.10.0.1/22
  pool?: string | undefined; // e.g. 10.10.0.10-10.10.3.250
};

export type ResolvedNetwork = {
  wan: string;
  lanBridge: string;
  lanPorts: string[];
  gatewayIp: string;
  prefix: number;
  networkCidr: string;
  pool: string;
};

const IFACE_RE = /^[A-Za-z0-9_.-]{1,32}$/;
const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}
function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
}

export const DEFAULT_NETWORK = {
  wan: "ether1",
  lanBridge: "bridge-hotspot",
  lanPorts: ["ether2", "ether3", "ether4", "ether5"],
  gateway: "10.10.0.1/22",
  pool: "10.10.0.10-10.10.3.250",
};

/** Validates overrides; invalid values fall back to defaults. */
export function resolveNetwork(o: NetworkOverrides = {}): ResolvedNetwork {
  const wan = o.wan && IFACE_RE.test(o.wan) ? o.wan : DEFAULT_NETWORK.wan;
  const lanBridge = o.lanBridge && IFACE_RE.test(o.lanBridge) ? o.lanBridge : DEFAULT_NETWORK.lanBridge;
  const ports = (o.lanPorts ?? []).map((p) => p.trim()).filter((p) => IFACE_RE.test(p) && p !== wan);
  const lanPorts = ports.length ? ports.slice(0, 24) : DEFAULT_NETWORK.lanPorts.filter((p) => p !== wan);

  let gw = DEFAULT_NETWORK.gateway;
  const gm = (o.gateway ?? "").trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if (gm && IP_RE.test(gm[1]) && Number(gm[2]) >= 16 && Number(gm[2]) <= 30) gw = `${gm[1]}/${gm[2]}`;
  const [gatewayIp, prefixStr] = gw.split("/");
  const prefix = Number(prefixStr);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const netInt = (ipToInt(gatewayIp) & mask) >>> 0;
  const networkCidr = `${intToIp(netInt)}/${prefix}`;

  let pool = "";
  const pm = (o.pool ?? "").trim().match(/^([\d.]+)-([\d.]+)$/);
  if (pm && IP_RE.test(pm[1]) && IP_RE.test(pm[2])) {
    const a = ipToInt(pm[1]);
    const b = ipToInt(pm[2]);
    if (a <= b && ((a & mask) >>> 0) === netInt && ((b & mask) >>> 0) === netInt) pool = `${pm[1]}-${pm[2]}`;
  }
  if (!pool) {
    if (gw === DEFAULT_NETWORK.gateway) pool = DEFAULT_NETWORK.pool;
    else {
      const broadcast = (netInt | (~mask >>> 0)) >>> 0;
      pool = `${intToIp(netInt + 10)}-${intToIp(broadcast - 5)}`;
    }
  }
  return { wan, lanBridge, lanPorts, gatewayIp, prefix, networkCidr, pool };
}

function buildNetworkSection(net: ResolvedNetwork, portalHost: string): string {
  const b = net.lanBridge;
  const ports = net.lanPorts
    .map((p) => `:do { /interface bridge port add bridge="${b}" interface="${p}" comment="PalNet" } on-error={}`)
    .join("\n");
  const gardenHosts = [portalHost, "*payhero.co.ke", "backend.payhero.co.ke", "api.payhero.co.ke", "*safaricom.co.ke"];
  const garden = gardenHosts
    .map((h) => `/ip hotspot walled-garden add dst-host="${h}" action=allow comment="PalNet"`)
    .join("\n");
  const gardenIp = gardenHosts
    .map((h) => `/ip hotspot walled-garden ip add dst-host="${h}" action=accept comment="PalNet"`)
    .join("\n");
  return `# --- Network: bridge ---
:if ([:len [/interface bridge find name="${b}"]] = 0) do={ /interface bridge add name="${b}" comment="PalNet" }
/interface bridge port remove [find comment="PalNet"]
${ports}
# --- IP addressing ---
/ip address remove [find comment="PalNet"]
/ip address add address=${net.gatewayIp}/${net.prefix} interface="${b}" comment="PalNet"
# --- Pool & DHCP ---
/ip dhcp-server remove [find name="palnet-dhcp"]
/ip pool remove [find name="palnet-pool"]
/ip pool add name="palnet-pool" ranges=${net.pool}
/ip dhcp-server add name="palnet-dhcp" interface="${b}" address-pool="palnet-pool" lease-time=1h disabled=no
/ip dhcp-server network remove [find comment="PalNet"]
/ip dhcp-server network add address=${net.networkCidr} gateway=${net.gatewayIp} dns-server=1.1.1.1,8.8.8.8 comment="PalNet"
# --- DNS ---
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
# --- NAT ---
/ip firewall nat remove [find comment="PalNet-masq"]
/ip firewall nat add chain=srcnat out-interface="${net.wan}" action=masquerade comment="PalNet-masq"
# --- Hotspot ---
/ip hotspot remove [find name="palnet-hotspot"]
/ip hotspot profile remove [find name="palnet-profile"]
/ip hotspot profile add name="palnet-profile" hotspot-address=${net.gatewayIp} dns-name="login.palnet" html-directory=hotspot login-by=http-chap,http-pap,mac-cookie
:do { /file remove [find name="hotspot/login.html"] } on-error={}
:do { /file add name="hotspot/login.html" contents="<html><head><meta http-equiv=\\"refresh\\" content=\\"0; url=https://${portalHost}/?mac=\\$(mac)&ip=\\$(ip)&link=\\$(link-login-only)\\"></head><body>Redirecting to PalNet...</body></html>" } on-error={ :log warning "PalNet: could not write hotspot/login.html" }
/ip hotspot add name="palnet-hotspot" interface="${b}" address-pool="palnet-pool" profile="palnet-profile" disabled=no
# --- Walled garden ---
/ip hotspot walled-garden remove [find comment="PalNet"]
${garden}
/ip hotspot walled-garden ip remove [find comment="PalNet"]
${gardenIp}
# --- Anti-tethering (TTL=1) ---
/ip firewall mangle remove [find comment="PalNet-ttl"]
/ip firewall mangle add chain=postrouting out-interface="${b}" action=change-ttl new-ttl=set:1 passthrough=no comment="PalNet-ttl"
`;
}

export function buildBootstrapScript({
  siteIdentity,
  token,
  heartbeatKey,
  configVersion = "v1",
  apiBaseUrl,
  network,
}: BootstrapScriptOptions & { network?: NetworkOverrides }): string {
  const baseUrl = resolveProvisionApiBaseUrl(apiBaseUrl);
  const net = resolveNetwork(network);
  const portalHost = (() => {
    try { return new URL(baseUrl).host; } catch { return "palnet-wifi.lovable.app"; }
  })();
  const networkSection = buildNetworkSection(net, portalHost.includes("lovable.app") ? "palnet-wifi.lovable.app" : portalHost);
  const site = rosEscape(normalizeSiteIdentity(siteIdentity));
  const tok = rosEscape(token);
  const key = rosEscape(heartbeatKey);
  const ver = rosEscape(configVersion);
  const registerUrl = `${baseUrl}/api/public/provision/register`;
  const heartbeatUrl = `${baseUrl}/api/public/provision/heartbeat`;
  // RouterOS: variable names must not contain "_"; inside strings a quote is \" .
  const q = '\\"';
  const regPayload =
    `("{${q}token${q}:${q}${tok}${q},${q}site_identity${q}:${q}${site}${q},${q}device_id${q}:${q}" . $board . "${q},${q}serial_number${q}:${q}" . $serial . "${q},${q}model${q}:${q}" . $model . "${q},${q}mac_address${q}:${q}" . $mac . "${q},${q}routeros_version${q}:${q}" . $ros . "${q},${q}board_name${q}:${q}" . $board . "${q}}")`;
  const hbPayload =
    `("{${q}site${q}:${q}" . $site . "${q},${q}device_id${q}:${q}" . $site . "${q},${q}cpu_load${q}:${q}" . $cpu . "${q},${q}free_memory${q}:${q}" . $mem . "${q},${q}uptime${q}:${q}" . $up . "${q}}")`;
  return `# PalNet bootstrap (RouterOS 7.x) config ${ver}
/system backup save name="before-palnet-provision" dont-encrypt=yes
/system identity set name="${site}"
${networkSection}
/system script remove [find name="PalNetRegister"]
/system script add name="PalNetRegister" policy=read,write,test source={
:local serial "unknown"
:do { :set serial [/system routerboard get serial-number] } on-error={}
:local model [/system resource get board-name]
:local mac ""
:do { :set mac [/interface ethernet get [find default-name=ether1] mac-address] } on-error={}
:local ros [/system resource get version]
:local board [/system identity get name]
:local payload ${regPayload}
/tool fetch url="${registerUrl}" mode=https http-method=post output=none http-header-field="Content-Type: application/json" http-data=$payload
}
/system script remove [find name="PalNetHeartbeat"]
/system script add name="PalNetHeartbeat" policy=read,write,test source={
:local cpu [/system resource get cpu-load]
:local mem [/system resource get free-memory]
:local up [/system resource get uptime]
:local site [/system identity get name]
:local payload ${hbPayload}
/tool fetch url="${heartbeatUrl}" mode=https http-method=post output=none http-header-field="Content-Type: application/json,X-PalNet-Key: ${key}" http-data=$payload
}
/system scheduler remove [find name="PalNetRegisterSchedule"]
/system scheduler add name="PalNetRegisterSchedule" interval=5m on-event="PalNetRegister" start-time=startup
/system scheduler remove [find name="PalNetHeartbeatSchedule"]
/system scheduler add name="PalNetHeartbeatSchedule" interval=1m on-event="PalNetHeartbeat" start-time=startup
:delay 2s
/system script run PalNetRegister
/system script run PalNetHeartbeat
:log info "PalNet provisioning complete"
`;
}
