import { expect, test, type Page } from "@playwright/test";

/**
 * What a real layout engine can tell us and happy-dom cannot.
 *
 * These assert geometry only. Content is already covered by the vitest suite,
 * and duplicating it here would buy nothing for a much slower test.
 */

const HERO = "haus-card";
const ALL_CARDS = [
  HERO,
  "haus-breakdown-card",
  "haus-spread-card",
  "haus-household-card",
  "haus-badge",
  "haus-tile",
];

/** The hero wraps when the column can no longer hold ring beside pillars. */
const WRAP_POINT = 448;

async function open(
  page: Page,
  card: string,
  width: number,
  variant = "full",
): Promise<void> {
  await page.goto(
    `/e2e/harness.html?card=${card}&width=${width}&variant=${variant}`,
  );
  await page.waitForSelector("body[data-ready='true']");
}

/** Box of an element inside the card's shadow root, in page coordinates. */
function box(page: Page, card: string, selector: string) {
  return page.evaluate(
    ([cardName, css]) => {
      const element = document
        .querySelector(cardName)
        ?.shadowRoot?.querySelector(css);
      if (!element) return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    },
    [card, selector] as const,
  );
}

test.describe("the hero card in a narrow column", () => {
  test("keeps the ring beside the pillars above the wrap point", async ({
    page,
  }) => {
    await open(page, HERO, WRAP_POINT);

    const ring = await box(page, HERO, ".ring-wrap");
    const pillars = await box(page, HERO, ".pillars");

    expect(ring).not.toBeNull();
    expect(pillars).not.toBeNull();
    // Side by side: the pillars start after the ring ends, on the same row.
    expect(pillars!.x).toBeGreaterThan(ring!.x + ring!.width - 1);
    expect(pillars!.y).toBeLessThan(ring!.y + ring!.height);
  });

  test("drops the pillars below the ring under the wrap point", async ({
    page,
  }) => {
    await open(page, HERO, WRAP_POINT - 1);

    const ring = await box(page, HERO, ".ring-wrap");
    const pillars = await box(page, HERO, ".pillars");

    expect(pillars!.y).toBeGreaterThanOrEqual(ring!.y + ring!.height - 1);
  });

  // The regression this exists for. Before the fix the ring sat hard left
  // against a column-wide void, which is what the "two visual blocks"
  // screenshot was, and no unit test could see it.
  for (const width of [400, 340, 296, 250]) {
    test(`centres the wrapped ring at ${width}px`, async ({ page }) => {
      await open(page, HERO, width);

      const card = await box(page, HERO, "ha-card");
      const ring = await box(page, HERO, ".ring-wrap");

      const ringCentre = ring!.x + ring!.width / 2;
      const cardCentre = card!.x + card!.width / 2;
      expect(Math.abs(ringCentre - cardCentre)).toBeLessThanOrEqual(1);
    });
  }

  test("leaves the ring where it was above the wrap point", async ({ page }) => {
    await open(page, HERO, 500);

    const card = await box(page, HERO, "ha-card");
    const ring = await box(page, HERO, ".ring-wrap");

    // Not centred: centring must be a no-op while the pillars absorb the
    // free space, or it would have moved the full-width layout too.
    const ringCentre = ring!.x + ring!.width / 2;
    const cardCentre = card!.x + card!.width / 2;
    expect(cardCentre - ringCentre).toBeGreaterThan(20);
  });
});

test.describe("nothing overflows its column", () => {
  for (const card of ALL_CARDS) {
    for (const width of [500, 300, 250]) {
      test(`${card} at ${width}px`, async ({ page }) => {
        await open(page, card, width);

        const overflow = await page.evaluate((cardName) => {
          const host = document.querySelector(cardName) as HTMLElement;
          return {
            scroll: host.scrollWidth,
            client: host.clientWidth,
            documentScroll: document.documentElement.scrollWidth,
            documentClient: document.documentElement.clientWidth,
          };
        }, card);

        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
        // The page itself must not gain a horizontal scrollbar either.
        expect(overflow.documentScroll).toBeLessThanOrEqual(
          overflow.documentClient + 1,
        );
      });
    }
  }
});

test.describe("the degraded footer", () => {
  test("renders one nag and the next action, not three lines", async ({
    page,
  }) => {
    await open(page, HERO, 250, "degraded");

    const lines = await page.evaluate(() => {
      const footer = document
        .querySelector("haus-card")
        ?.shadowRoot?.querySelector(".footer");
      return [...(footer?.children ?? [])].map((child) => child.className);
    });

    expect(lines).toEqual(["next-action", "cta"]);
  });
});
