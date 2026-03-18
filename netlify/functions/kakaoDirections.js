export async function handler(event) {
  try {
    const { origin, destination } = event.queryStringParameters || {};
    if (!origin || !destination) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'origin/destination required' }),
      };
    }

    const key = process.env.KAKAO_MOBILITY_REST_KEY;
    if (!key) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing KAKAO_MOBILITY_REST_KEY' }),
      };
    }

    const url = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${key}` },
    });

    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
}
