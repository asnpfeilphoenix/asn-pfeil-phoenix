export default function handler(req, res) {
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'repo,user',
    redirect_uri: `${process.env.URL}/api/callback`,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
