// Personal / freemail / disposable email domains that must NEVER be used
// to auto-join a workspace. Mirrors the server-side `is_personal_email_domain`
// SQL function — keep both in sync. The server is the source of truth; this
// client-side copy exists only to give immediate UI feedback before submit.

export const PERSONAL_EMAIL_DOMAINS = new Set<string>([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "outlook.co.uk", "hotmail.co.uk", "live.co.uk",
  "hotmail.fr", "live.fr", "outlook.fr",
  "hotmail.de", "live.de", "outlook.de",
  "hotmail.it", "live.it", "outlook.it",
  "hotmail.es", "live.es", "outlook.es",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // Yahoo / AOL
  "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.it", "yahoo.es",
  "yahoo.co.in", "yahoo.com.br", "yahoo.com.mx", "yahoo.ca", "yahoo.com.au",
  "ymail.com", "rocketmail.com", "aol.com", "aim.com",
  // Privacy-focused
  "proton.me", "protonmail.com", "pm.me",
  "tutanota.com", "tutanota.de", "tuta.io", "tutamail.com",
  "mailbox.org", "posteo.de", "posteo.net",
  "hey.com", "fastmail.com", "fastmail.fm",
  // GMX / Web.de / T-Online
  "gmx.com", "gmx.net", "gmx.de", "gmx.us", "gmx.co.uk", "gmx.fr",
  "web.de", "t-online.de", "freenet.de",
  // Yandex / Mail.ru
  "yandex.com", "yandex.ru", "ya.ru",
  "mail.ru", "bk.ru", "inbox.ru", "list.ru", "internet.ru",
  // Asia
  "qq.com", "163.com", "126.com", "sina.com", "sina.cn", "sohu.com",
  "foxmail.com", "aliyun.com", "naver.com", "daum.net", "hanmail.net",
  "rediffmail.com",
  // Other ISPs / freemail
  "zoho.com", "zohomail.com", "yopmail.com",
  "seznam.cz", "wp.pl", "onet.pl", "o2.pl", "interia.pl",
  "libero.it", "virgilio.it", "tin.it",
  "laposte.net", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "bbox.fr", "neuf.fr",
  "sky.com", "btinternet.com", "ntlworld.com", "virginmedia.com",
  "blueyonder.co.uk", "talktalk.net", "tiscali.co.uk",
  "bigpond.com", "bigpond.net.au", "optusnet.com.au", "xtra.co.nz",
  // Disposable / temp mail
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org",
  "sharklasers.com", "trashmail.com", "throwawaymail.com", "dispostable.com",
  "maildrop.cc", "getnada.com", "tempmail.com", "mintemail.com", "mohmal.com",
  "spambox.us",
]);

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase() || null;
}

export function isPersonalEmail(email: string | null | undefined): boolean {
  return isPersonalEmailDomain(getEmailDomain(email));
}
