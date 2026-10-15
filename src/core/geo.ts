/**
 * US-or-remote check. The MVP serves US students recruiting for US summer
 * internships, so non-US roles stay in the data (all-roles architecture)
 * but don't show in the app.
 */
import type { Posting } from './types.ts';

const US_STATES =
  'alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming';
const US_ABBR =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';

const US_RE = new RegExp(`\\b(united states|usa|u\\.s\\.a?\\.?|us|${US_STATES})\\b`, 'i');
const US_ABBR_RE = new RegExp(`(?:,\\s*|\\s)(${US_ABBR})\\b`);

const NON_US_RE =
  /\b(london|uk|united kingdom|england|scotland|ireland|dublin|paris|france|berlin|munich|frankfurt|germany|amsterdam|netherlands|zurich|geneva|switzerland|madrid|spain|milan|italy|stockholm|sweden|copenhagen|denmark|oslo|norway|warsaw|poland|tokyo|japan|hong kong|singapore|sydney|melbourne|australia|toronto|vancouver|montreal|canada|mexico|sao paulo|são paulo|brazil|bangalore|bengaluru|mumbai|hyderabad|india|shanghai|beijing|china|seoul|korea|tel aviv|israel|dubai|uae|emea|apac|latam|m\/w\/d)\b/i;

export function isUsLocation(text: string): boolean | null {
  if (US_RE.test(text) || US_ABBR_RE.test(text)) return true;
  if (NON_US_RE.test(text)) return false;
  return null;
}

/** true when the posting has a US city, is remote in the US, or doesn't say otherwise. */
export function isUsOrRemote(p: Pick<Posting, 'cities' | 'locations' | 'title' | 'remote'>): boolean {
  if (p.cities.some((c) => c !== 'other' && c !== 'remote')) return true;
  const verdicts = p.locations.map(isUsLocation);
  if (verdicts.includes(true)) return true;
  if (verdicts.includes(false)) return false;
  // Locations say nothing either way: a non-US title marker ("m/w/d", "Tokyo") decides.
  if (isUsLocation(p.title) === false) return false;
  return true;
}
