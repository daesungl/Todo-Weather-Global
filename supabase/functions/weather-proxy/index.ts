const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KMA_SERVICE_KEY = decodeURIComponent(Deno.env.get('KMA_SERVICE_KEY') || '');
const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY') || '';
const VWORLD_API_KEY = Deno.env.get('VWORLD_API_KEY') || '';

const ALLOWED_PATHS: Record<string, string[]> = {
  kma: [
    '1360000/WthrWrnInfoService/getWthrInfo',
    '1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
    '1360000/VilageFcstInfoService_2.0/getUltraSrtFcst',
    '1360000/VilageFcstInfoService_2.0/getVilageFcst',
    '1360000/MidFcstInfoService/getMidLandFcst',
    '1360000/MidFcstInfoService/getMidTa',
    '1360000/MidFcstInfoService/getMidFcst',
    'B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList',
    'B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty',
    'B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth',
  ],
  weatherapi: [
    'v1/forecast.json',
    'v1/current.json',
  ],
  vworld: [
    'req/address',
    'req/search',
  ],
};

const BASE_URLS: Record<string, string> = {
  kma: 'https://apis.data.go.kr',
  weatherapi: 'https://api.weatherapi.com',
  vworld: 'https://api.vworld.kr',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type, path, params } = await req.json();

    if (!type || !path) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders });
    }

    const allowedPaths = ALLOWED_PATHS[type];
    if (!allowedPaths) {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }

    if (!allowedPaths.includes(path)) {
      return new Response('Path not allowed', { status: 403, headers: corsHeaders });
    }

    const url = new URL(`${BASE_URLS[type]}/${path}`);

    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    if (type === 'kma') {
      url.searchParams.set('serviceKey', KMA_SERVICE_KEY);
    } else if (type === 'weatherapi') {
      url.searchParams.set('key', WEATHER_API_KEY);
    } else if (type === 'vworld') {
      url.searchParams.set('key', VWORLD_API_KEY);
    }

    const apiRes = await fetch(url.toString(), {
      headers: { Accept: 'application/json, */*' },
    });

    const body = await apiRes.text();
    const contentType = apiRes.headers.get('Content-Type') || 'application/json';

    return new Response(body, {
      status: apiRes.status,
      headers: { ...corsHeaders, 'Content-Type': contentType },
    });
  } catch (error) {
    console.error('[weather-proxy]', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
