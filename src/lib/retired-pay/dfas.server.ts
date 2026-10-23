import { combineBasicPayPages } from "./parse.ts";
import type { PayTable } from "./formula.ts";

const PAGES = [
  "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/CO/",
  "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/CO_FE/",
  "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/WO/",
  "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/",
];

/** Current official basic pay. Nothing is written down. Null when DFAS cannot be read. */
export async function readOfficialBasicPay(): Promise<PayTable | null> {
  try {
    const pages = await Promise.all(
      PAGES.map(async (url) => {
        const response = await fetch(url, {
          headers: {
            Accept: "text/html",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        if (!response.ok) return null;
        return response.text();
      }),
    );
    if (pages.some((page) => page == null)) return null;
    return combineBasicPayPages(pages as string[]);
  } catch {
    return null;
  }
}
