import { ComponentType } from "discord.js";
import { describe, expect, it } from "vitest";
import feedback, { buildFeedbackModal } from "../../commands/feedback";
import en from "../../locales/en.json";
import { getComponentHandler } from "../../structs/componentRouter";

describe("/feedback", () => {
  it("is a user-installable command with an English description", () => {
    const json = feedback.data.toJSON();
    expect(json.name).toBe("feedback");
    expect(json.description).toBe(en.feedback.description);
    expect(json.description.length).toBeLessThanOrEqual(100);
    expect(feedback.userInstallable).toBe(true);
  });

  it("builds a valid modal: optional kind select + required message", () => {
    const modal = buildFeedbackModal().toJSON() as any;
    expect(modal.custom_id).toBe("feedback:submit");
    expect(modal.title.length).toBeLessThanOrEqual(45);
    expect(modal.components).toHaveLength(2);
    const [kindLabel, messageLabel] = modal.components;
    expect(kindLabel.type).toBe(ComponentType.Label);
    expect(kindLabel.label.length).toBeLessThanOrEqual(45);
    expect(kindLabel.component).toMatchObject({ type: ComponentType.StringSelect, custom_id: "kind", required: false });
    expect(kindLabel.component.options.map((o: any) => o.value)).toEqual(["idea", "bug", "praise", "other"]);
    expect(messageLabel.label.length).toBeLessThanOrEqual(45);
    expect(messageLabel.description.length).toBeLessThanOrEqual(100);
    expect(messageLabel.component).toMatchObject({ type: ComponentType.TextInput, custom_id: "message", required: true, max_length: 2000 });
  });

  it("answers its modal through the persistent component router", () => {
    expect(getComponentHandler("feedback:submit")).not.toBeNull();
  });
});
