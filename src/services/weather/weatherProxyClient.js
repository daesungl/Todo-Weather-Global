import axios from 'axios';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/supabaseConfig';

const PROXY_URL = `${SUPABASE_URL}/functions/v1/weather-proxy`;

export const weatherProxy = (type, path, params, timeout = 8000) =>
  axios.post(PROXY_URL, { type, path, params }, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout,
  });
