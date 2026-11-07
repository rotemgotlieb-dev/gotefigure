// Facts shared by the two GoteDev Analytics legal pages (/privacy and /data-deletion), the
// URLs Meta's app review asks for. Fill each bracketed placeholder here once; both pages read
// from this file. Nothing here is a GoteFigure store fact: the store's own policy is /info/privacy.
export const GOTEDEV_LEGAL = {
  app: 'GoteDev Analytics',
  operator: 'Rotem Gotlieb, sole operator',
  contactEmail: 'hello@gotefigure.com',
  deletionDays: '30',
  retention: 'access tokens until you revoke them; post records 12 months',
  effective: 'November 6, 2026',
} as const;

export const hasRealEmail = GOTEDEV_LEGAL.contactEmail.includes('@');
