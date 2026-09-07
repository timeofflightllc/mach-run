import { ANNOUNCEMENTS } from "@/lib/announcements";
import type { SiteAnnouncement, SitePage } from "./types";

export const DEFAULT_PAGES: SitePage[] = [
  {
    slug: "about",
    title: "About",
    kicker: "",
    body: `MACH RUN is The Supersonic Retirement Calculator. You type the household as it stands — family, accounts, paychecks, spending, contributions — then hit Calculate. The engine runs an OODA Loop: Observe, Orient, Decide, Act.

It was built by a retired U.S. Air Force fighter pilot who wanted one place to see income sources, investment contributions (all types), and a nest-egg goal on the same strip. The name is Measure, Allocate, Compound, Harvest — MACH. The method is Boyd’s OODA loop, used here as a way to look at money — but was first used in teaching younger fighter pilots how to excel at dogfighting.

Free gets you in the cockpit with limits. Paid plans unlock the full ledger, Net Worth, encrypted backups, and OODA AI. None of it is financial, tax, legal, or investment advice. It is a planning sketch from the numbers you type.

Questions, a bug, or a feature you want on the jet — [Contact](/contact). What shipped recently lives on [Features](/announcements).`,
  },
  {
    slug: "contact",
    title: "Contact",
    kicker: "Pick a lane. It goes to the MACH RUN inbox. Reply-to is the email you type below.",
    body: "",
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    kicker: "Last updated: September 7, 2026",
    body: `MACH Run is a household calculator. You type in names, dates, balances, income, and spending so the engine can project a MACH Run. That is personal financial information. We treat it that way.

# What we collect
If you create an account: name, email address, password (stored hashed — we cannot read the password), and optional profile image if you sign in with Google, X, or Apple.

If you use MACH Run: the plan you type — family names and birth dates, account balances, income stages, contributions, spending, retirement dates, and the MACH OODA analysis generated from those numbers. If you subscribe: Stripe customer and subscription identifiers, not your full card number. Stripe processes the card.

If you ask OODA AI a question: that question and a compact snapshot of this MACH Run are sent to xAI so the model can answer. We do not use those questions to train a public marketing list.

Standard technical logs (IP address, browser, pages loaded) to keep the site running and to debug failures.

# How we use it
To run the calculator, save your MACH Run across devices, sign you in, take payment for Unlimited, answer OODA AI questions you ask, and keep the service secure. We do not use your household numbers to advertise other people’s products to you.

# What we will not do
We will not spam you. We will not sell, rent, trade, or otherwise knowingly give your personal information, financial inputs, passwords, or email address to marketers, data brokers, or anyone else for their own use.

We may share information only when: you ask us to (for example Stripe checkout); a processor must have it to run MACH Run (hosting, database, authentication, payments, OODA AI); or the law requires it. Processors are not allowed to use your data for their own marketing.

# Who sees the numbers
Your MACH Run is tied to your login. Other MACH RUN users cannot see it. Data is encrypted in transit (HTTPS) and saved plans are encrypted at rest on the server.

# Cookies and sign-in
We use a session cookie (or a short-lived token in the live preview) so you stay signed in. We do not run advertising pixels or sell browsing history.

# Keeping it
We keep your account and saved MACH Run while the account is open. You can ask us to delete the account and stored plan. Backups may lag for a short period. Billing records may be kept as required by tax and payment rules.

# Security
Passwords are hashed. Traffic is encrypted in transit (HTTPS). Saved MACH Runs are encrypted at rest. Optional .machrun backup files use a password only you know — we do not keep that password. No method is perfect. Do not reuse a bank password here. MACH Run is a planning tool, not a bank, broker, or custodian.

# Children
MACH Run is for adults. You may enter a child’s name and birth date as a dependent for VA or similar benefits. We do not knowingly create accounts for children under 13.

# Your choices
You can edit or clear inputs in the calculator, update email and password on Account profile, manage billing with Stripe, and sign out. For deletion of an account and stored plan, use [Contact](/contact) from the email on that account.

# Not advice
MACH Run, the MACH OODA Financial Analysis, and OODA AI are for entertainment and illustration. They are not financial, tax, legal, or investment advice.

# Changes
If this policy changes in a material way, we will update this page and the date above.`,
  },
  {
    slug: "announcements",
    title: "Feature announcements",
    kicker: "Last ships, newest first. Short notes only.",
    body: "",
  },
];

export function defaultAnnouncements(): SiteAnnouncement[] {
  return ANNOUNCEMENTS.map((item, i) => ({
    id: `seed-${i + 1}`,
    at: item.at,
    title: item.title,
    blurb: item.blurb,
    sortOrder: ANNOUNCEMENTS.length - i,
  }));
}
