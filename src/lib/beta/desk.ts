import type { BetaAnswers } from "./form";

export type BetaInvite = {
  email: string;
  submitted: number;
  limit: number;
};

export type BetaAccount = {
  email: string;
  name: string;
};

export type BetaDeskRow = {
  id: string;
  name: string;
  email: string;
  pass: number;
  submittedAt: string;
};

export type BetaDeskDetail = BetaDeskRow & { answers: BetaAnswers };
