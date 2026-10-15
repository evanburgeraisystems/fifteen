/**
 * Fixture emails (e2e/fixtures/emails/*.json) with what the classifier and
 * matcher should say about each. Loaded by tests and the app's dev tool
 * ("paste or pick a sample email"). All companies are fictional.
 */
import type { EmailKind, InboundEmail } from '../types.ts';

import peachtreeApplied from '../../../e2e/fixtures/emails/peachtree-applied-greenhouse.json' with { type: 'json' };
import magnoliaAssessment from '../../../e2e/fixtures/emails/magnolia-assessment-lever.json' with { type: 'json' };
import larkspurRejection from '../../../e2e/fixtures/emails/larkspur-rejection-ashby.json' with { type: 'json' };
import peachtreeInterview from '../../../e2e/fixtures/emails/peachtree-interview-invite.json' with { type: 'json' };
import northwindApplied from '../../../e2e/fixtures/emails/northwind-applied-workday.json' with { type: 'json' };
import northwindAssessment from '../../../e2e/fixtures/emails/northwind-assessment-shl.json' with { type: 'json' };
import northwindSuperday from '../../../e2e/fixtures/emails/northwind-superday-invite.json' with { type: 'json' };
import northwindOffer from '../../../e2e/fixtures/emails/northwind-offer.json' with { type: 'json' };
import halcyonApplied from '../../../e2e/fixtures/emails/halcyon-applied-icims.json' with { type: 'json' };
import halcyonRejection from '../../../e2e/fixtures/emails/halcyon-rejection-filled.json' with { type: 'json' };
import magnoliaOffer from '../../../e2e/fixtures/emails/magnolia-offer-fwd.json' with { type: 'json' };
import magnoliaVideo from '../../../e2e/fixtures/emails/magnolia-video-hirevue.json' with { type: 'json' };
import larkspurLinkedin from '../../../e2e/fixtures/emails/larkspur-applied-linkedin.json' with { type: 'json' };
import linkedinAlert from '../../../e2e/fixtures/emails/linkedin-job-alert.json' with { type: 'json' };
import peachtreeNewsletter from '../../../e2e/fixtures/emails/peachtree-culture-newsletter.json' with { type: 'json' };
import larkspurInfoSession from '../../../e2e/fixtures/emails/larkspur-info-session.json' with { type: 'json' };
import workdayReset from '../../../e2e/fixtures/emails/workday-password-reset.json' with { type: 'json' };
import northwindConditional from '../../../e2e/fixtures/emails/northwind-applied-conditional.json' with { type: 'json' };
import magnoliaRejection from '../../../e2e/fixtures/emails/magnolia-rejection-thanks.json' with { type: 'json' };
import peachtreeReschedule from '../../../e2e/fixtures/emails/peachtree-reschedule.json' with { type: 'json' };
import magnoliaPhoneScreen from '../../../e2e/fixtures/emails/magnolia-phone-screen.json' with { type: 'json' };
import handshakeTips from '../../../e2e/fixtures/emails/handshake-negotiation-tips.json' with { type: 'json' };
import larkspurPymetrics from '../../../e2e/fixtures/emails/larkspur-assessment-pymetrics.json' with { type: 'json' };
import halcyonInterview from '../../../e2e/fixtures/emails/halcyon-interview-final.json' with { type: 'json' };
import cinderoakApplied from '../../../e2e/fixtures/emails/cinderoak-applied-ashby.json' with { type: 'json' };
import ironbridgeRejection from '../../../e2e/fixtures/emails/ironbridge-rejection-icims.json' with { type: 'json' };
import evergreenOffer from '../../../e2e/fixtures/emails/evergreen-offer-lever.json' with { type: 'json' };
import larkspurBoilerplate from '../../../e2e/fixtures/emails/larkspur-applied-boilerplate.json' with { type: 'json' };
import careerFair from '../../../e2e/fixtures/emails/career-fair-reminder.json' with { type: 'json' };

export const EMAIL_FIXTURES: InboundEmail[] = [
  peachtreeApplied,
  magnoliaAssessment,
  larkspurRejection,
  peachtreeInterview,
  northwindApplied,
  northwindAssessment,
  northwindSuperday,
  northwindOffer,
  halcyonApplied,
  halcyonRejection,
  magnoliaOffer,
  magnoliaVideo,
  larkspurLinkedin,
  linkedinAlert,
  peachtreeNewsletter,
  larkspurInfoSession,
  workdayReset,
  northwindConditional,
  magnoliaRejection,
  peachtreeReschedule,
  magnoliaPhoneScreen,
  handshakeTips,
  larkspurPymetrics,
  halcyonInterview,
  cinderoakApplied,
  ironbridgeRejection,
  evergreenOffer,
  larkspurBoilerplate,
  careerFair,
];

export interface EmailExpectation {
  kind: EmailKind;
  /** Expected company guess; undefined = not asserted (mail that is not about one company). */
  company?: string;
  /** Expected role guess; undefined = not asserted. */
  role?: string;
}

/** Ground truth per fixture id. */
export const EMAIL_EXPECTATIONS: Record<string, EmailExpectation> = {
  'peachtree-applied-greenhouse': { kind: 'applied-confirmation', company: 'Peachtree Brands', role: 'Marketing Intern' },
  'magnolia-assessment-lever': { kind: 'assessment', company: 'Magnolia Media Group', role: 'Brand Marketing Intern' },
  'larkspur-rejection-ashby': { kind: 'rejection', company: 'Larkspur Consumer Co.', role: 'Social Media Marketing Intern' },
  'peachtree-interview-invite': { kind: 'interview', company: 'Peachtree Brands', role: 'Marketing Intern' },
  'northwind-applied-workday': { kind: 'applied-confirmation', company: 'Northwind Capital', role: 'Summer 2027 Investment Banking Analyst' },
  'northwind-assessment-shl': { kind: 'assessment', company: 'Northwind Capital', role: 'Summer 2027 Investment Banking Analyst' },
  'northwind-superday-invite': { kind: 'interview', company: 'Northwind Capital', role: 'Summer 2027 Investment Banking Analyst' },
  'northwind-offer': { kind: 'offer', company: 'Northwind Capital', role: 'Summer 2027 Investment Banking Analyst Intern' },
  'halcyon-applied-icims': { kind: 'applied-confirmation', company: 'Halcyon Advisory', role: 'Strategy & Advisory Intern' },
  'halcyon-rejection-filled': { kind: 'rejection', company: 'Halcyon Advisory', role: 'Strategy & Advisory Intern' },
  'magnolia-offer-fwd': { kind: 'offer', company: 'Magnolia Media Group', role: 'Brand Marketing Intern' },
  'magnolia-video-hirevue': { kind: 'assessment', company: 'Magnolia Media Group', role: 'Brand Marketing Intern' },
  'larkspur-applied-linkedin': { kind: 'applied-confirmation', company: 'Larkspur Consumer Co.', role: 'Social Media Marketing Intern' },
  'linkedin-job-alert': { kind: 'other' },
  'peachtree-culture-newsletter': { kind: 'other' },
  'larkspur-info-session': { kind: 'other' },
  'workday-password-reset': { kind: 'other' },
  'northwind-applied-conditional': { kind: 'applied-confirmation', company: 'Northwind Capital', role: 'Summer 2027 Investment Banking Analyst' },
  'magnolia-rejection-thanks': { kind: 'rejection', company: 'Magnolia Media Group', role: 'Brand Marketing Intern' },
  'peachtree-reschedule': { kind: 'interview', company: 'Peachtree Brands' },
  'magnolia-phone-screen': { kind: 'interview', company: 'Magnolia Media Group', role: 'Brand Marketing Intern' },
  'handshake-negotiation-tips': { kind: 'other' },
  'larkspur-assessment-pymetrics': { kind: 'assessment', company: 'Larkspur Consumer Co.', role: 'Social Media Marketing Intern' },
  'halcyon-interview-final': { kind: 'interview', company: 'Halcyon Advisory', role: 'Strategy & Advisory Intern' },
  'cinderoak-applied-ashby': { kind: 'applied-confirmation', company: 'Cinder & Oak Partners', role: 'Operations Analyst Intern' },
  'ironbridge-rejection-icims': { kind: 'rejection', company: 'Ironbridge Supply Co.', role: 'Supply Chain Analyst Intern' },
  'evergreen-offer-lever': { kind: 'offer', company: 'Evergreen Health Partners', role: 'Summer 2027 Finance Intern' },
  'larkspur-applied-boilerplate': { kind: 'applied-confirmation', company: 'Larkspur Consumer Co.', role: 'Content Marketing Intern' },
  'career-fair-reminder': { kind: 'other' },
};
