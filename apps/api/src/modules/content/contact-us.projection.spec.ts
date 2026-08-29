import { toContactUsContent } from "./contact-us.projection";

describe("toContactUsContent", () => {
  it("allow-lists confirmed contact facts and normalizes secure URLs", () => {
    expect(
      toContactUsContent({
        mainPhone: "  +98 21 0000  ",
        salesEmail: " sales@example.com ",
        linkedinUrl: "https://linkedin.com/company/example",
        instagramUrl: "javascript:alert(1)",
        id: 7,
        _status: "published",
      }),
    ).toEqual({
      mainPhone: "+98 21 0000",
      salesPhone: null,
      generalEmail: null,
      salesEmail: "sales@example.com",
      whatsappUrl: null,
      linkedinUrl: "https://linkedin.com/company/example",
      instagramUrl: null,
      telegramUrl: null,
      address: null,
    });
  });

  it("treats an empty document as unconfigured", () => {
    expect(toContactUsContent({ _status: "published" })).toBeNull();
  });
});
