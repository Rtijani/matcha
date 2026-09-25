import geoip from "geoip-lite";

export interface IpLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

const privateIpPattern =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd])/;

function normalizeIp(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isPrivateIp(ip: string): boolean {
  return privateIpPattern.test(ip);
}

/**
 * Best-effort city-level geolocation used when a user declines the
 * browser GPS prompt. Tries the offline MaxMind-lite database first
 * (works for real public client IPs, no network call); when the
 * request comes from a private/loopback address (the norm in local
 * dev, where the browser and API share the same machine) it falls
 * back to asking a public IP-geolocation service for the server's own
 * network location, which is the best approximation available.
 */
export async function locateByIp(
  ip: string,
): Promise<IpLocation | null> {
  const normalized = normalizeIp(ip);

  if (!isPrivateIp(normalized)) {
    const lookup = geoip.lookup(normalized);

    if (lookup) {
      return {
        latitude: lookup.ll[0],
        longitude: lookup.ll[1],
        city: lookup.city || null,
      };
    }
  }

  return fetchPublicIpLocation();
}

interface PublicIpProvider {
  url: string;
  parse: (data: unknown) => IpLocation | null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

// Several free, no-key providers are tried in turn since each one
// enforces its own rate limits; the first that answers wins.
const publicIpProviders: PublicIpProvider[] = [
  {
    url: "https://ipwho.is/",
    parse: (data) => {
      const record = data as {
        success?: boolean;
        latitude?: unknown;
        longitude?: unknown;
        city?: string;
      };

      const latitude = toFiniteNumber(record.latitude);
      const longitude = toFiniteNumber(record.longitude);

      if (
        record.success === false ||
        latitude === null ||
        longitude === null
      ) {
        return null;
      }

      return {
        latitude,
        longitude,
        city: record.city ?? null,
      };
    },
  },
  {
    url: "https://get.geojs.io/v1/ip/geo.json",
    parse: (data) => {
      const record = data as {
        latitude?: unknown;
        longitude?: unknown;
        city?: string;
      };

      const latitude = toFiniteNumber(record.latitude);
      const longitude = toFiniteNumber(record.longitude);

      if (latitude === null || longitude === null) {
        return null;
      }

      return {
        latitude,
        longitude,
        city: record.city ?? null,
      };
    },
  },
  {
    url: "https://ipapi.co/json/",
    parse: (data) => {
      const record = data as {
        latitude?: unknown;
        longitude?: unknown;
        city?: string;
      };

      const latitude = toFiniteNumber(record.latitude);
      const longitude = toFiniteNumber(record.longitude);

      if (latitude === null || longitude === null) {
        return null;
      }

      return {
        latitude,
        longitude,
        city: record.city ?? null,
      };
    },
  },
];

async function fetchFromProvider(
  provider: PublicIpProvider,
): Promise<IpLocation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(provider.url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return provider.parse(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPublicIpLocation(): Promise<IpLocation | null> {
  for (const provider of publicIpProviders) {
    const location = await fetchFromProvider(provider);

    if (location) {
      return location;
    }
  }

  return null;
}
