import { describe, it, expect } from 'vitest';
import {
  createProvisionToken,
  validateProvisionToken,
  parseDeviceRegistration,
  buildBootstrapScript,
  resolveProvisionApiBaseUrl,
} from './provisioning';

describe('zero-touch provisioning', () => {
  it('creates a token in the expected format and keeps it valid for the configured TTL', () => {
    const token = createProvisionToken('site-nairobi');
    expect(token).toMatch(/^prov_[a-z0-9_-]+$/i);

    const parsed = validateProvisionToken(token, new Date(Date.now() + 60_000).toISOString());
    expect(parsed.ok).toBe(true);
    expect(parsed.siteIdentity).toBe('site-nairobi');
  });

  it('rejects expired or malformed tokens', () => {
    const expired = validateProvisionToken('prov_invalid', new Date(Date.now() + 60_000).toISOString());
    expect(expired.ok).toBe(false);

    const bad = validateProvisionToken('prov_123', new Date(Date.now() - 60_000).toISOString());
    expect(bad.ok).toBe(false);
  });

  it('accepts a strict registration payload and generates bootstrap config that includes the config version and heartbeat key', () => {
    const payload = parseDeviceRegistration({
      token: 'prov_1234567890abcdef',
      site_identity: 'Nairobi-01',
      device_id: 'MKT-001',
      serial_number: '12345678',
      model: 'RB5009UG+',
      mac_address: '00:11:22:33:44:55',
      routeros_version: '7.14',
      board_name: 'rb5009ug',
    });

    expect(payload.ok).toBe(true);

    const script = buildBootstrapScript({
      siteIdentity: 'Nairobi-01',
      token: 'prov_1234567890abcdef',
      heartbeatKey: 'heartbeat-key-123456',
      configVersion: 'v1',
      apiBaseUrl: 'https://example.com',
    });

    expect(script).toContain('/system identity set name="Nairobi-01"');
    expect(script).toContain('config v1');
    expect(script).toContain('PalNetHeartbeat');
    expect(script).toContain('heartbeat-key-123456');
    expect(script).toContain('https://example.com/api/public/provision/register');
  });

  it('prefers the runtime or environment base URL over the hardcoded default', () => {
    expect(resolveProvisionApiBaseUrl('https://example.com')).toBe('https://example.com');
    expect(resolveProvisionApiBaseUrl()).toBe('https://palnet-wifi.lovable.app');
  });
});
