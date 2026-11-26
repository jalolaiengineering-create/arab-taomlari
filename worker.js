// Cloudflare Worker: landing formasi -> Telegram
// Settings -> Variables and Secrets:
//   BOT_TOKEN      — @BotFather bergan token (turi: Secret)
//   CHAT_ID        — arizalar boradigan chat yoki guruh ID (bir nechta bo'lsa vergul bilan)
//   ALLOWED_ORIGIN — landing manzili, masalan https://mijoz.uz (bir nechta bo'lsa vergul bilan; bo'sh = hamma)
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map(x => x.trim()).filter(Boolean);
    const any = allowed.includes('*');
    const okOrigin = any || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': any ? '*' : (okOrigin ? origin : 'null'),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    if (!okOrigin) return json({ ok: false, error: 'origin' }, 403);

    let d;
    try { d = JSON.parse(await request.text()); } catch { return json({ ok: false, error: 'json' }, 400); }
    if (!d || typeof d !== 'object') return json({ ok: false, error: 'json' }, 400);
    if (d.website) return json({ ok: true }); // spam tuzog'i: botga jim "ok" qaytaramiz

    const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
    const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const name = s(d.name, 100), phone = s(d.phone, 30), comment = s(d.comment, 1000);
    const digits = phone.replace(/\D/g, '');
    if (!name || digits.length < 9 || digits.length > 15) return json({ ok: false, error: 'invalid' }, 400);

    const src = [d.utm_source, d.utm_campaign].map(v => s(v, 100)).filter(Boolean).join(' / ');
    const lines = [
      `🆕 <b>Yangi ariza</b>${d.page ? ' — ' + esc(s(d.page, 100)) : ''}`,
      `👤 Ism: ${esc(name)}`,
      `📞 Tel: ${esc(phone)}`,
    ];
    if (comment) lines.push(`💬 Izoh: ${esc(comment)}`);
    if (src) lines.push(`📍 Manba: ${esc(src)}`);
    if (d.url) lines.push(`🔗 ${esc(s(d.url, 300))}`);
    const text = lines.join('\n');

    const ids = String(env.CHAT_ID || '').split(',').map(x => x.trim()).filter(Boolean);
    let sent = 0;
    for (const chat_id of ids) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        if (r.ok) sent++;
      } catch {}
    }
    return sent ? json({ ok: true }) : json({ ok: false, error: 'telegram' }, 502);
  },
};
