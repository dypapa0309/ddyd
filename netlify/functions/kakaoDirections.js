const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { origin, destination } = event.queryStringParameters || {};
    if (!origin || !destination) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'origin/destination required' }),
      };
    }

    const key = process.env.KAKAO_MOBILITY_REST_KEY;
    if (!key) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing KAKAO_MOBILITY_REST_KEY' }),
      };
    }

    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${key}`,
        Accept: 'application/json',
      },
    });

    const body = await response.text();
    return {
      statusCode: response.status,
      headers: corsHeaders,
      body,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(error) }),
    };
  }
}