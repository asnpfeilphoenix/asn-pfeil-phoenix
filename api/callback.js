export default async function handler(req, res) {
  const { code } = req.query;

  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(401).send(`
        <script>
          window.opener.postMessage(
            'authorization:github:error:${data.error}',
            '*'
          );
        </script>
      `);
    }

    const token = data.access_token;

    return res.status(200).send(`
      <script>
        window.opener.postMessage(
          'authorization:github:success:{"token":"${token}","provider":"github"}',
          '*'
        );
        window.close();
      </script>
    `);
  } catch (err) {
    return res.status(500).send(`
      <script>
        window.opener.postMessage(
          'authorization:github:error:${err.message}',
          '*'
        );
      </script>
    `);
  }
}
