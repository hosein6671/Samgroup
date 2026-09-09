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
