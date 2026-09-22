import { ANNOUNCEMENTS } from "@/lib/announcements";
import { DEFAULT_PRICING_COPY, serializePricingCopy } from "./pricing-copy";
import type { SiteAnnouncement, SitePage } from "./types";

export const DEFAULT_PAGES: SitePage[] = [
  {
    slug: "about",
    title: "About",
    kicker: "",
    body: `MACH RUN is The Supersonic Retirement Calculator. You type the household as it stands — family, accounts, paychecks, spending, contributions — then hit Calculate. The engine runs an OODA Loop: Observe, Orient, Decide, Act.

It was built by a retired U.S. Air Force fighter pilot who wanted one place to see income sources, investment contributions (all types), and a nest-egg goal on the same strip. The name is Measure, Allocate, Compound, Harvest — MACH. The method is Boyd’s OODA loop, used here as a way to look at money — but was first used in teaching younger fighter pilots how to excel at dogfighting.

Free gets you in the cockpit with limits. Paid plans unlock the full ledger, Net Worth, encrypted backups, and OODA AI. None of it is financial, tax, legal, or investment advice. It is a planning sketch from the numbers you type.

Questions, a bug, or a feature you want on the jet — [Contact](/contact). What shipped recently lives on [Features](/announcements). Common how-to lives on [FAQ](/faq).`,
  },
  {
    slug: "faq",
    title: "FAQ",
    kicker: "Kick the tires. Then light the fires.",
    body: `MACH RUN is a calculator, not a crystal ball. These answers match how the site works today. None of it is financial, tax, legal, or investment advice — it is a planning sketch from the numbers you type.

# What is MACH RUN?
MACH RUN is The Supersonic Financial Calculator. You type the household as it stands — family, accounts, paychecks, spending, contributions — then hit Calculate. The engine runs an OODA Loop on those numbers: Observe, Orient, Decide, Act. MACH stands for Measure, Allocate, Compound, Harvest.

# How do I start a MACH RUN?
Open Family, then Accounts. Add at least one income and your spending if you have it. Hit Calculate at the bottom of Observe, Orient, or Decide. Charts and the MACH OODA Financial Analysis stay frozen until you do. That is a MACH RUN.

# What does OODA mean here?
Observe, Orient, Decide, Act. It comes from U.S. Air Force Col. John Boyd (Ret.). On this site it is a way to look at money — not a trademarked product from anyone else. Observe is the household as it stands. Orient is where dollars go (income and spending). Decide is contributions. Act is the ledger, charts, and analysis after Calculate.

# Is this financial advice?
No. MACH RUN, the MACH OODA Financial Analysis, and OODA AI are for entertainment and illustration. Projections are hypothetical. Past performance does not guarantee future returns. Confirm Social Security, military retired pay, VA, and tax rules with the agency or a qualified advisor before you act. You own the decisions.

# What is free, and what do I pay for?
Free: register in about 30 seconds, save one household, with a limit of 2 accounts, 2 contributions, and 2 incomes. The OODA analysis is shortened.

Individual ($4/month or $40/year): one household, unlimited accounts, contributions, and incomes, plus the full MACH OODA Financial Analysis and OODA AI on that MACH RUN. Net Worth stays locked.

Individual Unlimited ($15/month or $150/year): everything in Individual, plus Net Worth (assets vs liabilities), a liabilities list, and encrypted MACH RUN backup download.

Advisor Lite and Advisor Unlimited are for professionals who need named client profiles. Details and a 7-day trial live on [Pricing](/pricing). Yearly billing is two months on us.

# How do I start if I am already retired?
In Family, set the retirement goal date — there is an “already retired” path so you can put the month and year you left work. Then add pension, Social Security, VA, and the rest as income blocks.

# Today’s dollars or future dollars?
Type amounts in today’s dollars (what the paycheck or balance is now). MACH RUN applies the return and COLA rates you set. Use the Today $ / Future $ control on the run to switch how the ledger is labeled. You are not supposed to enter 2041 dollars in a 2026 box.

# Why don’t the charts move until I hit Calculate?
On purpose. Fill Observe, Orient, and Decide, then Calculate. That keeps the MACH OODA Financial Analysis honest to a snapshot you chose, not every keystroke.

# What about Social Security, VA, and military retired pay?
Those are income kinds you name and date. Social Security can follow a family member and a claiming age. VA can use rating, spouse, and children under 18, then step down as kids turn 18. Figures are estimates, not official SSA, DFAS, or VA determinations.

# Does MACH RUN force RMDs?
For tax-qualified accounts, required minimum distributions are modeled in the background when the rules say they apply, and called out in the analysis. Still working and contributing to a 401(k) is treated differently than a retired IRA. Double-check IRS rules for your year.

# Can I save and come back?
Yes — register (email, Apple, Google, or X). Free saves the household with the 2/2/2 limits. Paid saves the full run. Advisor plans switch named profiles from a dropdown.

# Is my data encrypted? Can I download it?
Traffic is HTTPS. Saved MACH Runs are encrypted at rest. We do not sell your household numbers. Individual Unlimited and Advisor can download a password-protected .machrun backup — that password is not the site login, and MACH RUN does not keep it. Forget it, that file is gone. PDF summaries are illustrations, not advice.

# What is the idle privacy lock?
An optional PIN on Account profile (off by default). After about 10 minutes idle, the screen frosts so a passerby cannot read the ledger. It is not a second password and it does not replace sign-in.

# How do I cancel or change plans?
Account menu → Manage billing. Stripe handles upgrades with credit for time already paid when you step up a tier. Questions: [Contact](/contact).

# Who built this?
A retired U.S. Air Force fighter pilot who wanted one strip for income, contributions, a nest-egg goal, and the date the money runs out. More on [About](/about). Pronounce MACH like “mock.”`,
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
    kicker: "Ten newest ships on this page. Older notes sit behind a month.",
    body: "",
  },
  {
    slug: "pricing",
    title: "Pricing",
    kicker: "",
    body: serializePricingCopy(DEFAULT_PRICING_COPY),
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
