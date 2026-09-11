import { ConfigService } from "@nestjs/config";
import { ROLES_METADATA_KEY } from "../identity/decorators/roles.decorator";
import { CompanyEditorService, ContentEventsController } from "./company-editor.module";

describe("company editor gateway", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  const config = new ConfigService({
    PAYLOAD_INTERNAL_URL: "http://cms.internal",
    PAYLOAD_API_KEY: "read-only-test-key",
    PAYLOAD_EDITOR_SECRET: "separate-editor-test-key",
  });
  it("refuses unknown resources before contacting CMS", async () => {
    global.fetch = jest.fn();
    await expect(new CompanyEditorService(config).request("users", "actor")).rejects.toThrow(
      "Unknown content",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("uses independent server credentials and the authorized actor", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ revision: "one", fields: {} }), { status: 200 }),
      );
    global.fetch = fetchMock;
    await new CompanyEditorService(config).request("contact-us", "actor");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      actorId: "actor",
      action: "read",
    });
    expect(fetchMock.mock.calls[0][1].headers["x-editor-secret"]).toBe("separate-editor-test-key");
  });
  it("does not expose CMS errors or credentials", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("private upstream details", { status: 500 }));
    await expect(new CompanyEditorService(config).request("contact-us", "actor")).rejects.toThrow(
      "Content editing is unavailable.",
    );
  });
  it("keeps conflicts distinct from an unavailable service", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("", { status: 409 }));
    await expect(
      new CompanyEditorService(config).request("contact-us", "actor"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("requests bounded editorial history through the authenticated CMS transport", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
    global.fetch = fetchMock;
    await new CompanyEditorService(config).events({ page: 2, event: "content.publish" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://cms.internal/api/editor/events?page=2&event=content.publish",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(fetchMock.mock.calls[0][1].headers["x-editor-secret"]).toBe("separate-editor-test-key");
  });
  it("projects the editorial media library without leaking storage metadata", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 7,
              alt: "  Blending facility  ",
              url: "/media/cms/facility.webp",
              width: 1600,
              height: 900,
              filename: "facility.webp",
              filesize: 123456,
            },
            { id: 8, alt: "Wrong origin", url: "https://store.internal/private.png" },
          ],
          total: 2,
        }),
      ),
    );
    global.fetch = fetchMock;
    await expect(new CompanyEditorService(config).media()).resolves.toEqual({
      items: [
        {
          id: 7,
          alt: "Blending facility",
          url: "/media/cms/facility.webp",
          width: 1600,
          height: 900,
        },
      ],
      total: 2,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("http://cms.internal/api/editor/media");
  });
  it("uploads only a signature-matching bounded editorial image", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 9, alt: "Facility", url: "/media/cms/facility.jpg" })),
      );
    global.fetch = fetchMock;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    await new CompanyEditorService(config).uploadMedia(
      { buffer: jpeg, mimetype: "image/jpeg", originalname: "facility.jpg", size: jpeg.length },
      " Facility ",
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ alt: "Facility", name: "facility.jpg", mimeType: "image/jpeg" });
    expect(Buffer.from(body.content, "base64")).toEqual(jpeg);

    await expect(
      new CompanyEditorService(config).uploadMedia(
        {
          buffer: Buffer.from("not an image"),
          mimetype: "image/png",
          originalname: "fake.png",
          size: 12,
        },
        "Fake",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("does not turn unavailable history into an empty list", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(new CompanyEditorService(config).events({ page: 1 })).rejects.toMatchObject({
      status: 503,
    });
  });
  it("rejects reversed history ranges without contacting CMS", async () => {
    global.fetch = jest.fn();
    await expect(
      new CompanyEditorService(config).events({
        page: 1,
        from: "2026-09-10T00:00:00Z",
        to: "2026-09-09T00:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("restricts editorial history to Admin", () => {
    expect(Reflect.getMetadata(ROLES_METADATA_KEY, ContentEventsController)).toEqual(["ADMIN"]);
  });
});
