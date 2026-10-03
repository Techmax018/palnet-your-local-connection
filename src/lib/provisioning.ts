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
  const token = String(record.token ?? "").trim();
  const siteIdentity = String(record.site_identity ?? "").trim();
  const deviceId = String(record.device_id ?? "").trim();
  const serialNumber = String(record.serial_number ?? "").trim();
  const model = String(record.model ?? "").trim();
  const macAddress = String(record.mac_address ?? "").trim();
  const routerOsVersion = String(record.routeros_version ?? "").trim();
  const boardName = String(record.board_name ?? "").trim();

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

export function buildBootstrapScript({
  siteIdentity,
  token,
  heartbeatKey,
  configVersion = "v1",
  apiBaseUrl,
}: BootstrapScriptOptions): string {
  const baseUrl = resolveProvisionApiBaseUrl(apiBaseUrl);
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
