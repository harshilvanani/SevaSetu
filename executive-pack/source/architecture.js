// Executive architecture diagrams on a 1920 × 1080 canvas.
// Each diagram exists twice: `exec` (plain words) and `named` (plain words + product names under them).
//   groups: labelled containers   boxes: x, y, w, h, title, desc (plain), named (product names), tag ('New' | 'Upgraded')
//   arrows: [from, to, label?, fromSide?, toSide?]  sides: l r t b

const users = (extra = []) => [
  { id: 'vol', x: 70, y: 250, w: 300, h: 110, title: 'Volunteers', desc: 'Find seva, join, see hours', tone: 'vol' },
  { id: 'org', x: 70, y: 400, w: 300, h: 110, title: 'Organizers and coordinators', desc: 'Events, people, hours', tone: 'org' },
  ...extra,
];

const today = {
  file: 'architecture-today',
  overline: 'Architecture · today',
  title: 'SevaSetu today: simple, and live',
  subtitle: 'One secure service holds every rule, so web and phone apps behave the same.',
  groups: [
    { x: 40, y: 200, w: 360, h: 720, label: 'Who uses it' },
    { x: 470, y: 200, w: 400, h: 720, label: 'Apps' },
    { x: 940, y: 200, w: 560, h: 720, label: 'SevaSetu service', sub: 'hosted by Supabase · data in the United States', tone: 'core' },
    { x: 1570, y: 200, w: 310, h: 720, label: 'Outside services' },
  ],
  boxes: [
    ...users([{ id: 'adm', x: 70, y: 550, w: 300, h: 110, title: 'Platform admins', desc: 'Approve centres, keep it safe', tone: 'adm' }]),
    { id: 'web', x: 500, y: 300, w: 340, h: 150, title: 'Website and installable app', desc: 'Works on any phone or computer', named: 'Expo web app · hosted on Hostinger' },
    { id: 'mob', x: 500, y: 520, w: 340, h: 150, title: 'iPhone and Android apps', desc: 'In testing', named: 'Expo (React Native) · Expo Go' },
    { id: 'auth', x: 970, y: 260, w: 500, h: 110, title: 'Sign-in', desc: 'Email, Google or Apple', named: 'Supabase Auth' },
    { id: 'db', x: 970, y: 400, w: 500, h: 170, title: 'Secure database with the rules', desc: 'Spots, privacy, hours and matching are enforced here for everyone', named: 'PostgreSQL · row-level security · SQL functions' },
    { id: 'job', x: 970, y: 600, w: 240, h: 130, title: 'Reminders', desc: 'Hourly and daily', named: 'pg_cron' },
    { id: 'fn', x: 1230, y: 600, w: 240, h: 130, title: 'Server tasks', desc: 'Payments, push', named: 'Supabase Edge Functions' },
    { id: 'goo', x: 1600, y: 260, w: 250, h: 110, title: 'Google and Apple sign-in', named: 'OAuth' },
    { id: 'pay', x: 1600, y: 450, w: 250, h: 110, title: 'Payments', desc: 'Donations', named: 'Stripe Connect' },
    { id: 'push', x: 1600, y: 620, w: 250, h: 110, title: 'Phone notifications', named: 'Expo push' },
  ],
  arrows: [
    ['vol', 'web'], ['vol', 'mob'], ['org', 'web'], ['adm', 'web'],
    ['web', 'auth'], ['web', 'db', 'secure connection'], ['mob', 'db'],
    ['auth', 'goo'], ['fn', 'pay', null, 'r', 'l'], ['fn', 'push', null, 'r', 'l'],
  ],
  footer: 'Live today on the web · iPhone and Android in testing · English, Hindi, French',
};

const future = {
  file: 'architecture-future',
  overline: 'Architecture · future',
  title: 'SevaSetu on AWS: in Canada, built to grow',
  subtitle: 'Same app and the same rules, on a cloud that grows with the number of volunteers.',
  groups: [
    { x: 40, y: 200, w: 340, h: 760, label: 'Who uses it' },
    { x: 430, y: 200, w: 330, h: 760, label: 'Apps' },
    { x: 810, y: 200, w: 200, h: 760, label: 'Front door' },
    { x: 1060, y: 200, w: 560, h: 760, label: 'SevaSetu on AWS', sub: 'Canada (Montréal) · dev, test and live kept separate', tone: 'core' },
    { x: 1670, y: 200, w: 210, h: 760, label: 'Outside services' },
  ],
  boxes: [
    ...users([
      { id: 'lead', x: 70, y: 550, w: 280, h: 110, title: 'Leaders', desc: 'Dashboards, impact', tone: 'org' },
      { id: 'adm', x: 70, y: 700, w: 280, h: 110, title: 'Platform admins', desc: '2-step sign-in', tone: 'adm' },
    ]).map((b) => ({ ...b, w: 280 })),
    { id: 'web', x: 455, y: 260, w: 280, h: 140, title: 'Website and installable app', desc: 'Fast everywhere', named: 'S3 + CloudFront', tag: 'Upgraded' },
    { id: 'ios', x: 455, y: 460, w: 280, h: 120, title: 'iPhone app', desc: 'On the App Store', named: 'Expo · EAS build', tag: 'New' },
    { id: 'and', x: 455, y: 630, w: 280, h: 120, title: 'Android app', desc: 'On Google Play', named: 'Expo · EAS build', tag: 'New' },
    { id: 'gate', x: 830, y: 330, w: 160, h: 330, title: 'Firewall and fast delivery', desc: 'Blocks attacks and floods', named: 'AWS WAF · CloudFront · Route 53', tag: 'New' },
    { id: 'auth', x: 1085, y: 260, w: 250, h: 120, title: 'Sign-in', desc: '2-step for admins', named: 'Amazon Cognito', tag: 'Upgraded' },
    { id: 'api', x: 1355, y: 260, w: 240, h: 120, title: 'App services', desc: 'Grow on demand', named: 'API Gateway · Fargate · Lambda' },
    { id: 'db', x: 1085, y: 405, w: 510, h: 150, title: 'Secure database with the rules', desc: 'Same rules as today; grows automatically; copies in 2 data centres', named: 'Aurora PostgreSQL Serverless v2 · Multi-AZ', tag: 'Upgraded' },
    { id: 'job', x: 1085, y: 580, w: 160, h: 140, title: 'Scheduled jobs', desc: 'Reminders, summaries', named: 'EventBridge' },
    { id: 'mail', x: 1260, y: 580, w: 160, h: 140, title: 'Email', desc: 'Sign-up, updates', named: 'Amazon SES', tag: 'New' },
    { id: 'files', x: 1435, y: 580, w: 160, h: 140, title: 'File storage', desc: 'Certificates', named: 'Amazon S3', tag: 'New' },
    { id: 'safe', x: 1085, y: 745, w: 250, h: 130, title: 'Backups', desc: '35 days, copy in Calgary', named: 'Aurora backups · ca-west-1', tag: 'New' },
    { id: 'mon', x: 1355, y: 745, w: 240, h: 130, title: 'Monitoring and cost alerts', named: 'CloudWatch · Budgets', tag: 'New' },
    { id: 'goo', x: 1690, y: 260, w: 170, h: 120, title: 'Google and Apple sign-in', named: 'OAuth' },
    { id: 'pay', x: 1690, y: 430, w: 170, h: 110, title: 'Payments', named: 'Stripe Connect' },
    { id: 'push', x: 1690, y: 590, w: 170, h: 110, title: 'Phone notifications', named: 'Expo push' },
    { id: 'store', x: 1690, y: 750, w: 170, h: 110, title: 'App stores', named: 'Apple · Google Play', tag: 'New' },
  ],
  arrows: [
    ['vol', 'web'], ['vol', 'ios'], ['org', 'web'], ['org', 'and'], ['lead', 'web'], ['adm', 'web'],
    ['web', 'gate'], ['ios', 'gate'], ['and', 'gate'],
    ['gate', 'auth', null, 'r', 'l'], ['gate', 'db', null, 'r', 'l'],
    ['api', 'goo', null, 'r', 'l'], ['api', 'pay', null, 'r', 'l'], ['api', 'push', null, 'r', 'l'],
  ],
  footer: 'Planned move in 6 phases · nothing changes for volunteers except speed and new phone apps',
};

module.exports = [
  { ...today, variant: 'exec' },
  { ...today, variant: 'named', file: 'architecture-today-named', overline: 'Architecture · today · with product names' },
  { ...future, variant: 'exec' },
  { ...future, variant: 'named', file: 'architecture-future-named', overline: 'Architecture · future · with product names' },
];

// Today vs future scope table (one slide).
module.exports.scope = {
  file: 'scope-today-vs-future',
  overline: 'Scope',
  title: 'What changes from today to the future',
  rows: [
    ['Who uses it', 'Volunteers, organizers, admins', 'Same, plus leaders with dashboards and 2-step sign-in for admins'],
    ['Apps', 'Website and installable app; phone apps in testing', 'Website, plus iPhone and Android apps in the stores'],
    ['Where it runs', 'Supabase (United States) and Hostinger', 'AWS in Canada (Montréal), backup copy in Calgary'],
    ['Rules and data', 'One secure database with all the rules', 'Same database and rules, grows automatically, 2 data centres'],
    ['Safety', 'Access rules, audit log, security review', 'Plus firewall, rate limits, encryption keys, monitoring'],
    ['Growth', 'Hundreds of volunteers', 'Up to 50,000 volunteers, searches under 2 seconds'],
    ['New features', 'Discover, join, hours, teams, dashboard, impact', 'Plus application forms, badges, announcements, feedback'],
  ],
};
